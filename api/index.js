const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const admin = require('firebase-admin');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-client-id', 'x-client-secret']
}));

app.use(express.json());

const clientID = "129193925e1e0eea3a648a647049391921"; 
const secretKey = "cfsk_ma_prod_27ee4f24f381107f920156dc5ef18507_0990c498"; 

// 🔥 SECURE & CLEAN ENVIRONMENT INITIALIZATION
let firebaseApp;
if (!admin.apps.length) {
    try {
        // Render ke Environment Variables se key automatic pull hogi
        const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";
        const formattedKey = rawKey.replace(/\\n/g, '\n');

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: "mysticmate-chess-hub",
                clientEmail: "firebase-adminsdk-fbsvc@mysticmate-chess-hub.iam.gserviceaccount.com",
                privateKey: formattedKey
            }),
            databaseURL: "https://mysticmate-chess-hub-default-rtdb.asia-southeast1.firebasedatabase.app"
        });
    } catch (err) {
        console.error("Firebase initialization failed:", err);
    }
} else {
    firebaseApp = admin.apps[0];
}

const db = firebaseApp.database();

// Create Order Route
app.post('/create-order', async (req, res) => {
    try {
        const { amount, customerName, customerPhone, tournamentName } = req.body;
        const orderId = "order_" + Date.now(); 

        const response = await fetch("https://api.cashfree.com/pg/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-client-id": clientID,
                "x-client-secret": secretKey,
                "x-api-version": "2023-08-01"
            },
            body: JSON.stringify({
                order_id: orderId,
                order_amount: parseFloat(amount),
                order_currency: "INR",
                customer_details: {
                    customer_id: "cust_" + Date.now(),
                    customer_name: customerName,
                    customer_email: "player@mysticmate.com", 
                    customer_phone: customerPhone
                },
                order_meta: {
                    notify_url: "https://mysticmate-webhook.onrender.com/cashfree-webhook"
                },
                order_note: tournamentName
            })
        });

        const orderData = await response.json();
        
        if (orderData.payment_session_id) {
            return res.status(200).json({ 
                success: true, 
                payment_session_id: orderData.payment_session_id,
                order_id: orderId 
            });
        } else {
            return res.status(400).json({ success: false, details: orderData });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Webhook Route
app.post('/cashfree-webhook', async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const timestamp = req.headers['x-webhook-timestamp'];
        if (!signature || !timestamp) return res.status(200).send("OK");

        const rawBody = JSON.stringify(req.body);
        const dataToSign = timestamp + rawBody;
        const computedSignature = crypto.createHmac('sha256', secretKey).update(dataToSign).digest('base64');

        if (computedSignature !== signature) return res.status(400).send("Invalid Signature");

        const payload = req.body;
        if (payload.event === "ORDER_PAID" || (payload.data && payload.data.order && payload.data.order.order_status === "PAID")) {
            const orderId = payload.data.order.order_id; 
            const tourRef = db.ref("registrations");
            const passRef = db.ref("puzzle_pass_registrations");

            const tourSnap = await tourRef.once("value");
            tourSnap.forEach((child) => {
                if (child.val().paymentId === orderId) child.ref.update({ status: "Approved" });
            });

            const passSnap = await passRef.once("value");
            passSnap.forEach((child) => {
                if (child.val().paymentId === orderId) child.ref.update({ status: "Approved" });
            });
        }
        return res.status(200).send("OK");
    } catch (error) {
        return res.status(500).send("Internal Error");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Continuous Server process online at port ${PORT}`);
});

module.exports = app;
