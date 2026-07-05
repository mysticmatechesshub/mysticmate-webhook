const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

const clientID = "129193925e1e0eea3a648a647049391921"; 
const secretKey = "cfsk_ma_prod_27ee4f24f381107f920156dc5ef18507_0990c498"; 
const dbSecret = "SMn3KGEniy6MJonxSlonhyJ6qjj8m8s8EbuZHnD2"; 
const dbBaseUrl = `https://mysticmate-chess-hub-default-rtdb.asia-southeast1.firebasedatabase.app`;

// 🚀 AUTOMATED AFFILIATE WALLET ENGINE FOR ORIGINAL SCHEMAS
async function runOriginalAffiliateEngine(name, whatsapp, referralCode, amount, orderId, tournamentTitle) {
    try {
        const pRes = await fetch(`${dbBaseUrl}/players/${whatsapp}.json?auth=${dbSecret}`);
        const player = await pRes.json();
        if (!player) return;

        const actualRefCode = player.referrerCode || referralCode || "";
        if (!actualRefCode) return;

        const affRes = await fetch(`${dbBaseUrl}/affiliateUsers.json?auth=${dbSecret}`);
        const affiliateUsers = await affRes.json() || {};

        let affKey = null; let affData = null;
        for (const key in affiliateUsers) {
            if (affiliateUsers[key].code?.toUpperCase() === actualRefCode.toUpperCase()) {
                affKey = key; affData = affiliateUsers[key]; break;
            }
        }
        if (!affKey) return;

        const isFirst = !player.firstTournamentCommissionPaid;
        let rate = isFirst ? 0.20 : 0.10;
        const commission = Math.round(Number(amount) * rate);

        const currentIndiaDate = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" });

        // 1. Push transaction log inside walletTransactions
        await fetch(`${dbBaseUrl}/walletTransactions.json?auth=${dbSecret}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                affiliateCode: affData.code, affiliateMobile: affKey, mobile: affKey,
                playerName: name, playerMobile: whatsapp, tournament: tournamentTitle, registrationId: orderId,
                amount: Number(amount), commission, commissionPercent: rate * 100,
                type: "Credit", source: isFirst ? "First Tournament" : "Tournament Rejoin",
                status: "Approved", date: currentIndiaDate, createdAt: Date.now()
            })
        });

        // 2. Patch real balance inside affiliateUsers
        await fetch(`${dbBaseUrl}/affiliateUsers/${affKey}.json?auth=${dbSecret}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pendingAmount: Number(affData.pendingAmount || 0) + commission,
                totalEarned: Number(affiliateData.totalEarned || 0) + commission,
                totalReferrals: Number(affiliateData.totalReferrals || 0) + (isFirst ? 1 : 0)
            })
        });

        // 3. Update player status flag
        await fetch(`${dbBaseUrl}/players/${whatsapp}/firstTournamentCommissionPaid.json?auth=${dbSecret}`, { method: "PUT", body: JSON.stringify(true) });
    } catch (e) { console.error("Affiliate engine failure: ", e.message); }
}

// 🎯 REAL-TIME STATUS CHECK & PUSH WRITER GATEWAY
app.get('/check-status', async (req, res) => {
    try {
        const { order_id, name, whatsapp, lichess, referralCode, rating, state, nodeType, tournamentTitle, tournamentLink, amount } = req.query;
        if (!order_id) return res.status(400).json({ error: "Missing parameters" });

        const response = await fetch(`https://api.cashfree.com/pg/orders/${order_id}`, {
            method: "GET",
            headers: { "x-client-id": clientID, "x-client-secret": secretKey, "x-api-version": "2023-08-01", "Content-Type": "application/json" }
        });
        const orderDetails = await response.json();

        // 🔍 EXTRACTING CASHFREE GENERATED 12-DIGIT BANK UTR NUMBER
        let cashfreeBankUtr = order_id; // Default fallback to order_id if not present
        if (orderDetails.payment_gateway_details && orderDetails.payment_gateway_details.bank_reference) {
            cashfreeBankUtr = orderDetails.payment_gateway_details.bank_reference;
        }

        if (orderDetails.order_status === "PAID") {
            const targetNode = "registrations";
            
            // Backend strict evaluation routine
            const dupCheckRes = await fetch(`${dbBaseUrl}/${targetNode}.json?auth=${dbSecret}`);
            const dupCheckData = await dupCheckRes.json() || {};
            
            // 🔥 BACKEND COMPLIANT CHECK
            let isAlreadySaved = Object.values(dupCheckData).some(v => 
                v.paymentId === order_id || 
                v.paymentId === cashfreeBankUtr ||
                (v.whatsapp === whatsapp && v.tournament === tournamentTitle && v.status !== "Rejected" && v.status !== "Refunded")
            );

            // Find key if there is a pending state matching this order layout to update it
            let pendingNodeKey = Object.keys(dupCheckData).find(k => k === order_id);

            const currentIndiaDate = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" });

            const registrationData = {
                date: currentIndiaDate, name, whatsapp, lichess, rating, state,
                tournament: tournamentTitle, passName: tournamentTitle, amount: Number(amount || orderDetails.order_amount),
                paymentId: cashfreeBankUtr, // Overwriting database node with 12-digit bank UTR
                status: "Approved", referralCode: referralCode || "",
                commissionProcessed: (nodeType !== "PuzzlePass"), tournamentLink: tournamentLink || "", isNewPlayer: false,
                eventType: nodeType 
            };

            if (pendingNodeKey) {
                // If temporary register injection is found, overwrite the node and convert tracking ID into 12-digit UTR
                await fetch(`${dbBaseUrl}/${targetNode}/${pendingNodeKey}.json?auth=${dbSecret}`, {
                    method: "PUT",
                    body: JSON.stringify(registrationData)
                });
            } else if (!isAlreadySaved) {
                // Fallback creation block if no pre-modal entry layout was found
                await fetch(`${dbBaseUrl}/${targetNode}.json?auth=${dbSecret}`, {
                    method: "POST",
                    body: JSON.stringify(registrationData)
                });
            }

            // Sync master records framework
            const playerRes = await fetch(`${dbBaseUrl}/players/${whatsapp}.json?auth=${dbSecret}`);
            const playerExists = await playerRes.json();
            
            if (!playerExists) {
                await fetch(`${dbBaseUrl}/players/${whatsapp}.json?auth=${dbSecret}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        name, whatsapp, lichess, rating, state, firstJoined: new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }),
                        banned: false, referrerCode: referralCode || "", affiliateAssigned: !!referralCode, firstTournamentCommissionPaid: false
                    })
                });
            } else {
                // Update checkout order tracking log map inside system
                await fetch(`${dbBaseUrl}/players/${whatsapp}.json?auth=${dbSecret}`, {
                    method: "PATCH",
                    body: JSON.stringify({ order_id: cashfreeBankUtr })
                });
            }

            if (nodeType !== "PuzzlePass") {
                await runOriginalAffiliateEngine(name, whatsapp, referralCode, orderDetails.order_amount, cashfreeBankUtr, tournamentTitle);
            }
        }
        
        // Return 12-digit UTR directly in response stream for admin script matching interfaces
        return res.status(200).json({ 
            status: orderDetails.order_status || "PENDING", 
            utr: cashfreeBankUtr,
            bank_reference: cashfreeBankUtr
        });
    } catch (error) { return res.status(500).json({ error: error.message }); }
});

// Create Order Route
app.post('/create-order', async (req, res) => {
    try {
        const { amount, customerName, customerPhone, tournamentName } = req.body;
        const orderId = "order_" + Date.now(); 
        const response = await fetch("https://api.cashfree.com/pg/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-client-id": clientID, "x-client-secret": secretKey, "x-api-version": "2023-08-01" },
            body: JSON.stringify({
                order_id: orderId, order_amount: parseFloat(amount), order_currency: "INR",
                customer_details: { customer_id: "cust_" + Date.now(), customer_name: customerName, customer_email: "player@mysticmate.com", customer_phone: customerPhone },
                order_meta: { notify_url: "https://mysticmate-webhook.onrender.com/cashfree-webhook" }, order_note: tournamentName
            })
        });
        const orderData = await response.json();
        if (orderData.payment_session_id) {
            return res.status(200).json({ success: true, payment_session_id: orderData.payment_session_id, order_id: orderId });
        } else { return res.status(400).json({ success: false, details: orderData }); }
    } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Autopilot Engine Server Active`));
module.exports = app;
