const { query } = require('../src/db');
(async() => {
    try {
        // Set to 1 hour from now to avoid any "sniping too early" or "ended" issues during the fix
        const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await query(
            "UPDATE listings SET auction_end = $1, status = 'active' WHERE id = '49e08c15-cb43-4f56-8d38-a625e59270a3'",
            [futureDate]
        );
        console.log('Auction time-locked for 1 hour to allow safe fixing of frontend:', futureDate);
    } catch (err) {
        console.error('Update failed:', err);
    }
    process.exit(0);
})();
