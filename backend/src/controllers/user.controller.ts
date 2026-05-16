
import { Request, Response } from 'express';
import { User } from '../models/user.model';

// Get Current Logged In User
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;

    const user = await User.findOne({
      clerkId: userId,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update User Profile
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;

    const {
      bio,
      skills,
      github,
      linkedin,
      portfolio,
    } = req.body;

    const updatedUser = await User.findOneAndUpdate(
      {
        clerkId: userId,
      },
      {
        bio,
        skills,
        github,
        linkedin,
        portfolio,
      },
      {
        new: true,
      }
    );

    return res.status(200).json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};


