const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

const clientID = "129193925e1e0eea3a648a647049391921"; 
const secretKey = "cfsk_ma_prod_27ee4f24f381107f920156dc5ef18507_0990c498"; 
const dbSecret = "SMn3KGEniy6MJonxSlonhyJ6qjj8m8s8EbuZHnD2"; 
const dbBaseUrl = `https://mysticmate-chess-hub-default-rtdb.asia-southeast1.firebasedatabase.app`;

// Redesigned Pure Autopilot Affiliate Calculation Matrix
async function runNewAutopilotAffiliateEngine(name, whatsapp, referralCode, amount, orderId, tournamentTitle) {
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

        // A. Generate Unique Node entry under walletTransactions node
        await fetch(`${dbBaseUrl}/walletTransactions/tx_${orderId}.json?auth=${dbSecret}`, {
            method: "PUT",
            body: JSON.stringify({
                affiliateCode: affData.code, affiliateMobile: affKey, mobile: affKey,
                playerName: name, playerMobile: whatsapp, tournament: tournamentTitle, registrationId: orderId,
                amount: Number(amount), commission, commissionPercent: rate * 100,
                type: "Credit", source: isFirst ? "First Tournament" : "Tournament Rejoin",
                status: "Approved", date: new Date().toLocaleString("en-GB"), createdAt: Date.now()
            })
        });

        // B. Dynamic Balance increments onto parent profiles
        await fetch(`${dbBaseUrl}/affiliateUsers/${affKey}.json?auth=${dbSecret}`, {
            method: "PATCH",
            body: JSON.stringify({
                pendingAmount: Number(affData.pendingAmount || 0) + commission,
                totalEarned: Number(affData.totalEarned || 0) + commission,
                totalReferrals: Number(affData.totalReferrals || 0) + (isFirst ? 1 : 0)
            })
        });

        // C. Complete lifecycle validation flag check
        await fetch(`${dbBaseUrl}/players/${whatsapp}/firstTournamentCommissionPaid.json?auth=${dbSecret}`, { 
            method: "PUT", body: JSON.stringify(true) 
        });
        
    } catch (e) { console.error("Affiliate engine failure: ", e.message); }
}

// Full Fast Checker Gateway Endpoint Tracker
app.get('/check-status', async (req, res) => {
    try {
        const { order_id, name, whatsapp, lichess, referralCode, rating, state, nodeType, tournamentTitle, tournamentLink } = req.query;
        if (!order_id) return res.status(400).json({ error: "Missing tracking keys" });

        const response = await fetch(`https://api.cashfree.com/pg/orders/${order_id}`, {
            method: "GET",
            headers: { "x-client-id": clientID, "x-client-secret": secretKey, "x-api-version": "2023-08-01", "Content-Type": "application/json" }
        });
        const orderDetails = await response.json();

        if (orderDetails.order_status === "PAID") {
            const targetNode = nodeType === "PuzzlePass" ? "puzzle_pass_registrations" : "registrations";
            
            const dupRes = await fetch(`${dbBaseUrl}/${targetNode}/${order_id}.json?auth=${dbSecret}`);
            const dupData = await dupRes.json();

            // Fire write engine blocks only if unique order node slots are clean empty
            if (!dupData) {
                const registrationData = {
                    date: new Date().toLocaleString("en-GB"), name, whatsapp, lichess, rating, state,
                    tournament: tournamentTitle, passName: tournamentTitle, amount: orderDetails.order_amount,
                    paymentId: order_id, status: "Approved", referralCode: referralCode || "",
                    commissionProcessed: (nodeType !== "PuzzlePass"), tournamentLink: tournamentLink || ""
                };

                // Secure PUT mapping bypass
                await fetch(`${dbBaseUrl}/${targetNode}/${order_id}.json?auth=${dbSecret}`, {
                    method: "PUT",
                    body: JSON.stringify(registrationData)
                });

                // Profile initialization sync tag checks
                const playerRes = await fetch(`${dbBaseUrl}/players/${whatsapp}.json?auth=${dbSecret}`);
                const playerExists = await playerRes.json();
                
                if (!playerExists) {
                    await fetch(`${dbBaseUrl}/players/${whatsapp}.json?auth=${dbSecret}`, {
                        method: "PUT",
                        body: JSON.stringify({
                            name, whatsapp, lichess, rating, state, firstJoined: new Date().toLocaleDateString("en-GB"),
                            banned: false, referrerCode: referralCode || "", affiliateAssigned: !!referralCode, firstTournamentCommissionPaid: false
                        })
                    });
                }

                // Fire payout splits strictly if normal tour is evaluated
                if (nodeType !== "PuzzlePass") {
                    await runNewAutopilotAffiliateEngine(name, whatsapp, referralCode, orderDetails.order_amount, order_id, tournamentTitle);
                }
            }
        }
        return res.status(200).json({ status: orderDetails.order_status || "PENDING" });
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
app.listen(PORT, () => console.log(`🚀 Redesigned Master Autopilot Engine Active`));
module.exports = app;
