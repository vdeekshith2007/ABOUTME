const express = require("express");

const app = express();

const PORT = 3000;

app.get("/", (req, res) => {
    res.send("Express server is running!");
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});