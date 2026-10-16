const paypal = require("../../helpers/paypal");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../../models/Order");
const Course = require("../../models/Course");
const StudentCourses = require("../../models/StudentCourses");

async function stripeRequest(endpoint, params, method = "POST") {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    const error = new Error("Stripe is not configured");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`https://api.stripe.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(params && { "Content-Type": "application/x-www-form-urlencoded" }),
    },
    ...(params && { body: new URLSearchParams(params) }),
  });
  const result = await response.json();

  if (!response.ok) {
    console.error("Stripe API request failed:", result.error?.message);
    const error = new Error("Stripe could not process the payment request");
    error.statusCode = 502;
    throw error;
  }

  return result;
}

async function enrollStudentInCourse({
  userId,
  userName,
  userEmail,
  courseId,
  courseTitle,
  instructorId,
  instructorName,
  courseImage,
  coursePricing,
  dateOfPurchase,
}) {
  await StudentCourses.updateOne(
    { userId },
    {
      $setOnInsert: { userId },
      $addToSet: {
        courses: {
          courseId,
          title: courseTitle,
          instructorId,
          instructorName,
          dateOfPurchase,
          courseImage,
        },
      },
    },
    { upsert: true }
  );

  await Course.updateOne(
    { _id: courseId },
    {
      $addToSet: {
        students: {
          studentId: userId,
          studentName: userName,
          studentEmail: userEmail,
          paidAmount: String(coursePricing),
        },
      },
    }
  );
}

async function finalizeStripeOrder(order, session) {
  const expectedAmount = Math.round(Number(order.coursePricing) * 100);
  const paymentMatches =
    session.payment_status === "paid" &&
    session.status === "complete" &&
    session.mode === "payment" &&
    session.currency === "usd" &&
    session.amount_total === expectedAmount &&
    session.client_reference_id === String(order._id) &&
    session.metadata?.orderId === String(order._id) &&
    session.metadata?.userId === order.userId &&
    session.metadata?.courseId === order.courseId;

  if (!paymentMatches) {
    const error = new Error("Stripe payment details do not match this order");
    error.statusCode = 400;
    throw error;
  }

  if (order.paymentStatus !== "paid") {
    if (order.paymentStatus !== "initiated") {
      const error = new Error("This order cannot be completed");
      error.statusCode = 409;
      throw error;
    }

    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    await order.save();
  }

  await enrollStudentInCourse({
    userId: order.userId,
    userName: order.userName,
    userEmail: order.userEmail,
    courseId: order.courseId,
    courseTitle: order.courseTitle,
    instructorId: order.instructorId,
    instructorName: order.instructorName,
    courseImage: order.courseImage,
    coursePricing: order.coursePricing,
    dateOfPurchase: order.orderDate,
  });
}

function isValidStripeSignature(signatureHeader, payload, secret) {
  if (typeof signatureHeader !== "string" || !Buffer.isBuffer(payload)) {
    return false;
  }

  const signatureParts = signatureHeader.split(",");
  const timestamp = signatureParts
    .find((part) => part.startsWith("t="))
    ?.slice(2);
  const timestampSeconds = Number(timestamp);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > 300
  ) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(payload)
    .digest();

  return signatureParts
    .filter((part) => part.startsWith("v1="))
    .some((part) => {
      const receivedSignature = Buffer.from(part.slice(3), "hex");
      return (
        receivedSignature.length === expectedSignature.length &&
        crypto.timingSafeEqual(receivedSignature, expectedSignature)
      );
    });
}

const handleStripeWebhook = async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(503).json({
      success: false,
      message: "Stripe webhook is not configured",
    });
  }

  if (
    !isValidStripeSignature(
      req.headers["stripe-signature"],
      req.body,
      webhookSecret
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook signature",
    });
  }

  try {
    const event = JSON.parse(req.body.toString("utf8"));
    if (
      ![
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type)
    ) {
      return res.status(200).json({ received: true });
    }

    const session = event.data?.object;
    if (!mongoose.isValidObjectId(session?.metadata?.orderId)) {
      return res.status(400).json({
        success: false,
        message: "Stripe event is missing a valid order",
      });
    }

    const order = await Order.findOne({
      _id: session.metadata.orderId,
      userId: session.metadata.userId,
      paymentMethod: "stripe",
      paymentId: session.id,
    });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Stripe order cannot be found",
      });
    }

    if (session.payment_status === "paid") {
      await finalizeStripeOrder(order, session);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Could not process Stripe webhook:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Could not process Stripe webhook",
    });
  }
};

const createOrder = async (req, res) => {
  try {
    const { courseId, paymentMethod = "paypal" } = req.body || {};
    if (!["paypal", "stripe"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported payment method",
      });
    }

    const userId = String(req.user._id);

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({
        success: false,
        message: "A valid course is required",
      });
    }

    const course = await Course.findById(courseId);
    if (!course || !course.isPublised) {
      return res.status(404).json({
        success: false,
        message: "Published course not found",
      });
    }

    if (String(course.instructorId) === userId) {
      return res.status(403).json({
        success: false,
        message: "Instructors cannot purchase their own course",
      });
    }

    const studentCourses = await StudentCourses.findOne({ userId });
    if (studentCourses?.courses?.some((item) => item.courseId === courseId)) {
      return res.status(409).json({
        success: false,
        message: "You already own this course",
      });
    }

    const coursePricing = Number(course.pricing);
    if (!Number.isFinite(coursePricing) || coursePricing < 0) {
      return res.status(400).json({
        success: false,
        message: "Course price is invalid",
      });
    }

    const orderDate = new Date();
    const user = req.user;

    if (coursePricing === 0) {
      await enrollStudentInCourse({
        userId,
        userName: user.userName,
        userEmail: user.userEmail,
        courseId,
        courseTitle: course.title,
        instructorId: course.instructorId,
        instructorName: course.instructorName,
        courseImage: course.image,
        coursePricing,
        dateOfPurchase: orderDate,
      });

      return res.status(201).json({
        success: true,
        data: { freeCourse: true, courseId },
      });
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    if (paymentMethod === "stripe") {
      const amountInCents = Math.round(coursePricing * 100);
      if (amountInCents < 1) {
        return res.status(400).json({
          success: false,
          message: "Course price must be at least one cent",
        });
      }

      const order = new Order({
        userId,
        userName: user.userName,
        userEmail: user.userEmail,
        orderStatus: "pending",
        paymentMethod: "stripe",
        paymentStatus: "initiated",
        orderDate,
        paymentId: "",
        payerId: "",
        instructorId: course.instructorId,
        instructorName: course.instructorName,
        courseImage: course.image,
        courseTitle: course.title,
        courseId,
        coursePricing,
      });

      await order.save();

      try {
        const session = await stripeRequest("/v1/checkout/sessions", {
          mode: "payment",
          success_url: `${clientUrl}/payment-return?provider=stripe&orderId=${order._id}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${clientUrl}/course/details/${courseId}?payment=cancelled`,
          client_reference_id: String(order._id),
          customer_email: user.userEmail,
          "metadata[orderId]": String(order._id),
          "metadata[userId]": userId,
          "metadata[courseId]": courseId,
          "line_items[0][price_data][currency]": "usd",
          "line_items[0][price_data][product_data][name]": course.title,
          "line_items[0][price_data][unit_amount]": String(amountInCents),
          "line_items[0][quantity]": "1",
        });

        if (!session.id || !session.url) {
          throw new Error("Stripe did not return a checkout URL");
        }

        order.paymentId = session.id;
        await order.save();

        return res.status(201).json({
          success: true,
          data: {
            checkoutUrl: session.url,
            orderId: order._id,
          },
        });
      } catch (error) {
        order.paymentStatus = "failed";
        await order.save();
        console.error("Could not create Stripe checkout:", error.message);
        return res.status(error.statusCode || 502).json({
          success: false,
          message: error.statusCode
            ? error.message
            : "Could not start Stripe checkout",
        });
      }
    }

    const create_payment_json = {
      intent: "sale",
      payer: {
        payment_method: "paypal",
      },
      redirect_urls: {
        return_url: `${clientUrl}/payment-return`,
        cancel_url: `${clientUrl}/course/details/${courseId}?payment=cancelled`,
      },
      transactions: [
        {
          item_list: {
            items: [
              {
                name: course.title,
                sku: courseId,
                price: coursePricing.toFixed(2),
                currency: "USD",
                quantity: 1,
              },
            ],
          },
          amount: {
            currency: "USD",
            total: coursePricing.toFixed(2),
          },
          description: course.title,
        },
      ],
    };

    paypal.payment.create(create_payment_json, async (error, paymentInfo) => {
      if (error) {
        console.log(error);
        return res.status(500).json({
          success: false,
          message: "Error while creating paypal payment!",
        });
      } else {
        try {
          const approveUrl = paymentInfo.links.find(
            (link) => link.rel === "approval_url"
          )?.href;

          if (!approveUrl || !paymentInfo.id) {
            return res.status(502).json({
              success: false,
              message: "PayPal did not return an approval link",
            });
          }

          const newlyCreatedCourseOrder = new Order({
            userId,
            userName: user.userName,
            userEmail: user.userEmail,
            orderStatus: "pending",
            paymentMethod: "paypal",
            paymentStatus: "initiated",
            orderDate,
            paymentId: paymentInfo.id,
            payerId: "",
            instructorId: course.instructorId,
            instructorName: course.instructorName,
            courseImage: course.image,
            courseTitle: course.title,
            courseId,
            coursePricing,
          });

          await newlyCreatedCourseOrder.save();

          res.status(201).json({
            success: true,
            data: {
              approveUrl,
              orderId: newlyCreatedCourseOrder._id,
            },
          });
        } catch (saveError) {
          console.log(saveError);
          res.status(500).json({
            success: false,
            message: "Could not save the order",
          });
        }
      }
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const capturePaymentAndFinalizeOrder = async (req, res) => {
  try {
    const { paymentId, payerId, orderId } = req.body;

    if (!mongoose.isValidObjectId(orderId) || !paymentId || !payerId) {
      return res.status(400).json({
        success: false,
        message: "Payment details are incomplete",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      userId: String(req.user._id),
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order cannot be found",
      });
    }

    if (order.paymentStatus === "paid" && order.paymentId === paymentId) {
      await enrollStudentInCourse({
        userId: order.userId,
        userName: order.userName,
        userEmail: order.userEmail,
        courseId: order.courseId,
        courseTitle: order.courseTitle,
        instructorId: order.instructorId,
        instructorName: order.instructorName,
        courseImage: order.courseImage,
        coursePricing: order.coursePricing,
        dateOfPurchase: order.orderDate,
      });

      return res.status(200).json({
        success: true,
        message: "Order already confirmed",
        data: order,
      });
    }

    if (order.paymentStatus !== "initiated" || order.paymentId !== paymentId) {
      return res.status(409).json({
        success: false,
        message: "This order cannot be captured",
      });
    }

    paypal.payment.execute(
      paymentId,
      { payer_id: payerId },
      async (error, paymentInfo) => {
        if (error) {
          console.log(error);
          return res.status(400).json({
            success: false,
            message: "PayPal could not confirm this payment",
          });
        }

        try {
          const transaction = paymentInfo?.transactions?.[0];
          const payerMatches =
            paymentInfo?.payer?.payer_info?.payer_id === payerId;
          const amountMatches =
            transaction?.amount?.currency === "USD" &&
            Number(transaction.amount.total).toFixed(2) ===
              Number(order.coursePricing).toFixed(2);
          const courseMatches = transaction?.item_list?.items?.some(
            (item) =>
              item.sku === order.courseId &&
              Number(item.price).toFixed(2) ===
                Number(order.coursePricing).toFixed(2)
          );

          if (
            paymentInfo?.state !== "approved" ||
            !payerMatches ||
            !amountMatches ||
            !courseMatches
          ) {
            return res.status(400).json({
              success: false,
              message: "PayPal payment details do not match this order",
            });
          }

          order.paymentStatus = "paid";
          order.orderStatus = "confirmed";
          order.payerId = payerId;
          await order.save();

          await enrollStudentInCourse({
            userId: order.userId,
            userName: order.userName,
            userEmail: order.userEmail,
            courseId: order.courseId,
            courseTitle: order.courseTitle,
            instructorId: order.instructorId,
            instructorName: order.instructorName,
            courseImage: order.courseImage,
            coursePricing: order.coursePricing,
            dateOfPurchase: order.orderDate,
          });

          return res.status(200).json({
            success: true,
            message: "Order confirmed",
            data: order,
          });
        } catch (finalizeError) {
          console.log(finalizeError);
          return res.status(500).json({
            success: false,
            message: "Payment was confirmed but enrollment could not finish",
          });
        }
      }
    );
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const completeStripeCheckout = async (req, res) => {
  try {
    const { orderId, sessionId } = req.body || {};
    if (!mongoose.isValidObjectId(orderId) || typeof sessionId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Payment details are incomplete",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      userId: String(req.user._id),
    });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order cannot be found",
      });
    }
    if (order.paymentMethod !== "stripe" || order.paymentId !== sessionId) {
      return res.status(409).json({
        success: false,
        message: "This Stripe session does not match the order",
      });
    }

    if (order.paymentStatus !== "paid") {
      if (order.paymentStatus !== "initiated") {
        return res.status(409).json({
          success: false,
          message: "This order cannot be completed",
        });
      }

      const session = await stripeRequest(
        `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
        null,
        "GET"
      );
      await finalizeStripeOrder(order, session);
    }

    return res.status(200).json({
      success: true,
      message: "Order confirmed",
      data: order,
    });
  } catch (error) {
    console.error("Could not complete Stripe checkout:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Could not confirm Stripe payment",
    });
  }
};

module.exports = {
  createOrder,
  capturePaymentAndFinalizeOrder,
  completeStripeCheckout,
  handleStripeWebhook,
};
