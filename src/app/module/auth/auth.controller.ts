const googleAuth = async (req: Request, res: Response): Promise<void> => {
};

export const authController = {
  register,
  login,
  getMe,
  changePassword,
  logout,
  googleAuth,
};
