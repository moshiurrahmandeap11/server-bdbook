import cors from "cors";
import dotenv from "dotenv";
import express from "express";
dotenv.config();

const port = process.env.PORT;
const app = express();

// import routes
import { connectDB } from "./database/db.js";
import users from "./routes/userRoute/userRoute.js";


// middleware
app.use(express.json());
app.use(cors());


// mongo connection
await connectDB();


// routes
app.use("/v1/api/users", users);

app.get("/", (req, res) => {
    res.send("BD BOOK server running ")
})

app.listen(port, () => {
    console.log(`bd book server running on port http://localhost:${port}`);
})