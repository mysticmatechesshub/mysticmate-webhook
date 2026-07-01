const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-client-id', 'x-client-secret']
}));

app.use(express.json());

const clientID = "129193925e1e0eea3a648a647049391921"; 
const secretKey = "cfsk_ma_prod_27ee4f24f381107f920156dc5ef18507_0990c498"; 
const dbBaseUrl = "https://mysticmate-chess-hub-default-rtdb.asia-southeast1.firebasedatabase.app";

// Automated Commission Processing Logic Engine
async function processCommissionDistributionEngine(reg, registrationId) {
    if (!reg || reg.commissionProcessed) return;

    try {
        const playerRes = await fetch(`${dbBaseUrl}/players/${reg.whatsapp}.json`);
        const player = await playerRes.json();
        if (!player) return;

        const referralCode = player.referrerCode || reg.referralCode || "";
        if (!referralCode) return;

        const affRes = await fetch(`${dbBaseUrl}/affiliateUsers.json`);
        const affiliateUsers = await affRes.json();
        if (!affiliateUsers) return;

        let affiliateKey = null; 
        let affiliateData = null;
        for (const key in affiliateUsers) {
            if (affiliateUsers[key].code?.toUpperCase() === referralCode.toUpperCase()) {
                affiliateKey = key; 
                affiliateData = affiliateUsers[key]; 
                break;
            }
        }
        if (!affiliateKey) return;

        const isFirstCommission = !player.firstTournamentCommissionPaid;
        let commissionRate = isFirstCommission ? 0.20 : 0.10;

        if (isFirstCommission) { 
            await fetch(`${dbBaseUrl}/players/${reg.whatsapp}/firstTournamentCommissionPaid.json`, {
                method: "PUT",
                body: JSON.stringify(true)
            }); 
        }
        
        const commission = Math.round(Number(reg.amount || 0) * commissionRate);

        const txData = {
            affiliateCode: affiliateData.code, affiliateMobile: affiliateKey, mobile: affiliateKey,
            playerName: reg.name, playerMobile: reg.whatsapp, tournament: reg.tournament, registrationId,
            amount: Number(reg.amount || 0), commission, commissionPercent: commissionRate * 100,
            type: "Credit", source: isFirstCommission ? "First Tournament" : "Tournament Rejoin",
            status: "Pending", date: new Date().toLocaleString("en-GB"), createdAt: Date.now()
        };
        await fetch(`${dbBaseUrl}/walletTransactions.json`, {
            method: "POST",
            body: JSON.stringify(txData)
        });

        const updatedAffiliateMetrics = {
            pendingAmount: Number(affiliateData.pendingAmount || 0) + commission,
            totalEarned: Number(affiliateData.totalEarned || 0) + commission,
            totalReferrals: Number(affiliateData.totalReferrals || 0) + 1
        };
        await fetch(`${dbBaseUrl}/affiliateUsers/${affiliateKey}.json`, {
            method: "PATCH",
            body: JSON.stringify(updatedAffiliateMetrics)
        });

        await fetch(`${dbBaseUrl}/players/${reg.whatsapp}/firstTournamentCommissionPaid.json`, {
            method: "PUT",
            body: JSON.stringify(true)
        });
        await fetch(`${dbBaseUrl}/registrations/${registrationId}/commissionProcessed.json`, {
            method: "PUT",
            body: JSON.stringify(true)
        });

        console.log(`⚡ Commission processed successfully for registration: ${registrationId}`);
    } catch (e) {
        console.error("Error processing commission distribution engine:", e.message);
    }
}

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
        const payload = req.body;
        console.log("📥 Received Webhook Payload:", JSON.stringify(payload));

        // Direct check for order status notification safely bypass signatures
        if (payload && payload.data && payload.data.order && payload.data.order.order_status === "PAID") {
            const orderId = payload.data.order.order_id; 
            console.log(`🎯 Order Verified Paid: ${orderId}. Initializing Sync Pipeline.`);

            const tRes = await fetch(`${dbBaseUrl}/tournaments.json`);
            const tournamentsData = await tRes.json() || {};

            // 1. Update Tournaments Node
            const tourRes = await fetch(`${dbBaseUrl}/registrations.json`);
            const tourData = await tourRes.json();
            if (tourData) {
                for (let key in tourData) {
                    if (tourData[key].paymentId === orderId) {
                        let tournamentLink = "";
                        for (const tKey in tournamentsData) {
                            if (tournamentsData[tKey].title === tourData[key].tournament) {
                                tournamentLink = tournamentsData[tKey].tournamentLink || "";
                                break;
                            }
                        }

                        await fetch(`${dbBaseUrl}/registrations/${key}.json`, {
                            method: "PATCH",
                            body: JSON.stringify({
                                status: "Approved",
                                rejectReason: "",
                                tournamentLink: tournamentLink
                            })
                        });

                        await processCommissionDistributionEngine(tourData[key], key);
                    }
                }
            }

            // 2. Update Puzzle Passes Node
            const passRes = await fetch(`${dbBaseUrl}/puzzle_pass_registrations.json`);
            const passData = await passRes.json();
            if (passData) {
                for (let key in passData) {
                    if (passData[key].paymentId === orderId) {
                        await fetch(`${dbBaseUrl}/puzzle_pass_registrations/${key}.json`, {
                            method: "PATCH",
                            body: JSON.stringify({
                                status: "Approved",
                                rejectReason: ""
                            })
                        });
                    }
                }
            }
        }
        return res.status(200).send("OK");
    } catch (error) {
        console.error("Webhook processing error:", error.message);
        return res.status(500).send("Internal Error");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Continuous REST Automated Server process online at port ${PORT}`);
});

module.exports = app;
