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

// 🔥 MULTI-LINE ENTERPRISE STANDARD SERVICE KEY INITIALIZATION
let firebaseApp;
if (!admin.apps.length) {
    try {
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: "mysticmate-chess-hub",
                clientEmail: "firebase-adminsdk-fbsvc@mysticmate-chess-hub.iam.gserviceaccount.com",
                privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC0kIQoK/pgSbLw
t3XAAm91k5P9aSvV7Hflz6PyA8DEsQD8e3l5fcgpqjpRdERHTtDxa3Awm/EqvuME
CQVmBnbDLsRLvJR8e86QBc7T151ytF1eUP6ed+jp32aUbHqeNbBqR2nwRvVgtzmd
LBaelVX1OKW0F7LzbBmrcwwjZTuhM34so+RkIF458q/EcCJx9MoAg2SVrL+4YUN/
j9DnQeQu59ashp4zGlzo4lVho+4UHdaj87VYJbC/IrK5PdDvpamzdzUj/UbNfGbX
eXCj2uAZeImb8KNiM9qc4riPYpcEOC7cY+iV0P4zenuW9DELwnwRQr2LMClNXl+j
jhPINsxHAgMBAAECggEABf3VpM+bcJ6BcDi7kNzZKKRLq4OrOgoCtdQnXdx/WlzV
nP4uJWF1ddaR5vZeHZyZXtesZae4tbnxZuW84h/jRmrXD5boi4zk90sxJNKuu7yN1
BbAtAsJ6hBLZqzXToR7+9PKHCBC9YQbeGTe2oxnUJF2g11JXVHnTJZFHvH+bdESG
29cHXcTxPBmFr9aXifhtKZ/eUqqSA/pADtS/byHrJyacCtAvjC3qTP0nYgKuxmqD
Opt7SD8f53vz0oM/6MTpSST3kKiZucfmdPm45h2QfmsEW1unC0VX1H8KE41JV5rg
waEDxrqEBXPrvHnh1VDMm60Z6f+UCgnkTb2SAMDJgQKBgQDkcFLtSE4G6bO7s+op
SIJT7s5GzAASkxAGFspYTdBMGoo/GcwkOJDK0oxhvbVdOIyr7InLuTom2StJ1txc
yv2sLDU7//wuwP62T0YUeMwua8KsHVKZutTUARItfkXn6C4lhy4WaI3cPKUacHwC
IjBX9LeXaxIcUVLc14tONVFhUQKBgQDKWYYcXva3P+lbf02yxzHlbO+rEPxUyriD
wawXTIgVhVNT6dBUbCkQGOlK2dbt9kFlIVsXzHf/yAEQ2qRY1IK0xXZQYBmc3p/g
7eOPq3lGoneKLwm+IFdIoPhr/3Nghm5yl7WTvMRM0VO/l8KftA1IyK7nwwWjobkl
Su1McSKuFwKBgQCNdwXTzcgMPePBJLypDi8vXR6+9wxAdHQi4TAzmRSaXIEqbIZg
E+uOvu6ShNHwxdlPiq8Wy0E415oYIwfaKxcG7WWWH4ODTJ8wNU131grT4IXw4kPJ
0cqE85jXNXCDGeSh9uHSnLLlJWU1R110UMnRXknnajYP9Ui0XIL3Tstz0QKBgEIZ
PFXIL49ssS3SR+8+Ym4vR5r50XNhRSTE/xIdTda51p5yojrxmfhIKuzoe+z/pB0E
6Fy9zfUfwDlhMo5R3OBwIFXhDnzPvCodi1hDCzqnl6Tr+KLCrcBr1Lpyl53QTAPi
s2XvAfb2R+c01aX2j8MTxYl/pGVIoWsFBgEXO/BAoGAJuN0vK2h2oyPOaiGnP82
2pbM7DX9Rs8a9H5+t04AR4LYq118VqY6LQXBr7PTjydE+KvS7r5ej6YPsr78x6DK
KLyfgVEtLGTZXWzD8Wmh89dC1CAFFyuSLjEP+jNmW8gIIrB/nHpyIYeeGIWR6hch
bp/NsOL8/hWydjAE6vJgBlk=
-----END PRIVATE KEY-----`
            }),
            databaseURL: "https://mysticmate-chess-hub-default-rtdb.asia-southeast1.firebasedatabase.app"
        });
        console.log("🔥 Firebase Environment Linked Successfully!");
    } catch (err) {
        console.error("Firebase initialization failed:", err.message);
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
