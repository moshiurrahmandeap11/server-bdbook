import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.js";
import { authController } from "./auth.controller.js";
import { authValidation } from "./auth.validation.js";
const router = Router();
router.post("/signup", validateRequest(authValidation.signupValidationSchema), authController.signup);
router.post("/login", validateRequest(authValidation.loginValidationSchema), authController.login);
router.post("/logout", authController.logout);
export const authRoutes = router;
