const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ message: "Settore spedizioni pronto" }));

module.exports = router;