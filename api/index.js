const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

const clientID = "129193925e1e0eea3a648a647049391921"; 
const secretKey = "cfsk_ma_prod_27ee4f24f381107f920156dc5ef18507_0990c498"; 
const dbSecret = "SMn3KGEniy6MJonxSlonhyJ6qjj8m8s8EbuZHnD2"; 
const dbBaseUrl = `https://mysticmate-chess-hub-default-rtdb.asia-southeast1.firebasedatabase.app`;

// Automated Affiliate Engine Managed Securely on Backend Server
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

        // Wallet Transaction Node Update
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

        // Patch affiliate balances
        await fetch(`${dbBaseUrl}/affiliateUsers/${affKey}.json?auth=${dbSecret}`, {
            method: "PATCH",
            body: JSON.stringify({
                pendingAmount: Number(affData.pendingAmount || 0) + commission,
                totalEarned: Number(affData.totalEarned || 0) + commission,
                totalReferrals: Number(affData.totalReferrals || 0) + (isFirst ? 1 : 0)
            })
        });

        await fetch(`${dbBaseUrl}/players/${whatsapp}/firstTournamentCommissionPaid.json?auth=${dbSecret}`, { method: "PUT", body: JSON.stringify(true) });
    } catch (e) { console.error("Affiliate Logic Error: ", e.message); }
}

// 🚀 TARGET STEP A: PRE-SAVE PENDING ENTRY DIRECTLY VIA BACKEND
app.post('/pre-save-registration', async (req, res) => {
    try {
        const { order_id, name, whatsapp, lichess, referralCode, rating, state, nodeType, tournamentTitle, tournamentLink } = req.body;
        const targetNode = nodeType === "PuzzlePass" ? "puzzle_pass_registrations" : "registrations";

        const registrationData = {
            date: new Date().toLocaleString("en-GB"), name, whatsapp, lichess, rating, state,
            tournament: tournamentTitle, passName: tournamentTitle, amount: 0, 
            paymentId: order_id, status: "Pending", referralCode: referralCode || "",
            commissionProcessed: false, tournamentLink: tournamentLink || ""
        };

        await fetch(`${dbBaseUrl}/${targetNode}/reg_${order_id}.json?auth=${dbSecret}`, {
            method: "PUT",
            body: JSON.stringify(registrationData)
        });

        return res.status(200).json({ success: true });
    } catch (error) { return res.status(500).json({ error: error.message }); }
});

// 🚀 TARGET STEP B: CASHFREE OFFICIAL WEBHOOK TUNNEL FOR SECURE AUTO-APPROVAL
app.post('/cashfree-webhook', async (req, res) => {
    try {
        const payload = req.body;
        console.log("📥 Webhook Triggered:", JSON.stringify(payload));
        if (!payload) return res.status(200).send("Empty");

        let orderId = null;
        let isPaid = false;

        if (payload.data && payload.data.order) {
            orderId = payload.data.order.order_id;
            isPaid = payload.data.order.order_status === "PAID";
        } else if (payload.order) {
            orderId = payload.order.order_id;
            isPaid = payload.order.order_status === "PAID" || payload.order.status === "PAID";
        }

        if (orderId && isPaid) {
            // Check in both nodes where reg_{orderId} exists
            let finalTargetNode = "registrations";
            let checkReg = await fetch(`${dbBaseUrl}/registrations/reg_${orderId}.json?auth=${dbSecret}`);
            let regData = await checkReg.json();

            if (!regData) {
                finalTargetNode = "puzzle_pass_registrations";
                checkReg = await fetch(`${dbBaseUrl}/puzzle_pass_registrations/reg_${orderId}.json?auth=${dbSecret}`);
                regData = await checkReg.json();
            }

            if (regData && regData.status !== "Approved") {
                // Update Amount and Force Status to Approved
                await fetch(`${dbBaseUrl}/${finalTargetNode}/reg_${orderId}.json?auth=${dbSecret}`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: "Approved", amount: payload.data?.order?.order_amount || regData.amount })
                });

                // Profile initialization if new player profile is mapped
                const playerCheck = await fetch(`${dbBaseUrl}/players/${regData.whatsapp}.json?auth=${dbSecret}`);
                const playerExists = await playerCheck.json();
                
                if (!playerExists) {
                    await fetch(`${dbBaseUrl}/players/${regData.whatsapp}.json?auth=${dbSecret}`, {
                        method: "PUT",
                        body: JSON.stringify({
                            name: regData.name, whatsapp: regData.whatsapp, lichess: regData.lichess, rating: regData.rating, state: regData.state,
                            firstJoined: new Date().toLocaleDateString("en-GB"), banned: false, referrerCode: regData.referralCode || "",
                            affiliateAssigned: !!regData.referralCode, firstTournamentCommissionPaid: false
                        })
                    });
                }

                if (finalTargetNode !== "puzzle_pass_registrations") {
                    await runOriginalAffiliateEngine(regData.name, regData.whatsapp, regData.referralCode, regData.amount, orderId, regData.tournament);
                }
            }
        }
        return res.status(200).send("OK");
    } catch (error) {
        console.error("Webhook processing error: ", error.message);
        return res.status(500).send("Error");
    }
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
app.listen(PORT, () => console.log(`🚀 Autopilot Webhook Engine Online`));
module.exports = app;
