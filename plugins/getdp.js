const { cmd } = require("../arslan");
const { fakevCard } = require("../lib/fakevCard");
const config = require("../config");

// Turns a locally-typed number into the full international format WhatsApp
// JIDs need (no leading 0, no +, no spaces/dashes).
//   03001234567        -> 923001234567   (Pakistani local format, auto-detected)
//   92301234567        -> 92301234567    (already international, left as-is)
//   <countrycode><num>  -> left as-is     (any other country)
function normalizeToInternational(raw) {
    let digits = (raw || "").replace(/[^\d]/g, "");
    if (!digits) return null;
    if (digits.startsWith("0")) {
        // Local Pakistani format (0300...) -> international (92300...)
        digits = "92" + digits.slice(1);
    }
    if (digits.length < 10 || digits.length > 15) return null;
    return digits;
}

cmd({
    pattern: "getdp",
    alias: ["getdp2", "numdp"],
    react: "🖼️",
    desc: "Get someone's WhatsApp profile picture by phone number",
    category: "tools",
    use: ".getdp <number>  (e.g. .getdp 03001234567 or .getdp 923001234567)",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, args }) => {
    try {
        const input = (q || (args && args[0]) || "").trim();
        if (!input) {
            return reply(
                "❌ Number dein.\n\n" +
                "*Usage:*\n" +
                "`.getdp 03001234567` _(Pakistani local number)_\n" +
                "`.getdp 923001234567` _(already with country code)_\n" +
                "`.getdp <countrycode><number>` _(kisi bhi doosre mulk ke liye)_"
            );
        }

        const number = normalizeToInternational(input);
        if (!number) {
            return reply("❌ Ye number sahi format mein nahi hai. Country code ke sath poora number dein (jaise `.getdp 923001234567`).");
        }

        const jid = `${number}@s.whatsapp.net`;

        let ppUrl;
        try {
            ppUrl = await conn.profilePictureUrl(jid, "image");
        } catch (e) {
            return reply(`❌ Is number (+${number}) ki DP nahi mil saki — ya to unhone DP nahi lagayi, ya privacy setting ki wajah se sirf contacts ko dikhti hai.`);
        }

        if (!ppUrl) {
            return reply(`❌ Is number (+${number}) ki koi profile picture nahi mili.`);
        }

        await conn.sendMessage(from, {
            image: { url: ppUrl },
            caption: `👤 *Profile Picture*\n📱 Number: +${number}\n\n${config.BOT_NAME}`
        }, { quoted: fakevCard });

    } catch (e) {
        console.error("GetDP Error:", e.message);
        reply("❌ Kuch masla ho gaya: " + e.message);
    }
});
