import { Router } from "express";
import { db } from "../../database/db.js";

const router = Router();

router.get("/", async(req, res) => {
    try {
        const users = db.collection("users").find({}, {projection: { password: 0 }}).toArray();

        res.json({
            success: true,
            message: "Users fetched successfully",
            data: users
        })
    } catch (error) {
        console.error("Failed to fetching users : ", error);
        res.status(500).json({
            success: false,
            message: "Unable to fetched users data"
        })
    }
})

export default router;