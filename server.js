import cors from "cors";
import dotenv from "dotenv";
import express from "express";
dotenv.config();

const port = process.env.PORT;
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("BD BOOK server running ")
})

app.listen(port, () => {
    console.log(`bd book server running on port http://localhost:${port}`);
})