const multer = require('multer');
const moment = require('moment');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('../controllers/handlerFactory');
const AppError = require('../utils/appError');
const Email = require('../utils/email');
const { getUploadingSignedURL } = require('../utils/s3');
const { v4: uuidv4 } = require('uuid');

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  const files = req.files;
  const { user } = req;

  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400
      )
    );
  }

  if (files?.photo) {
    req.body.photo = req?.files?.photo[0].key;
    // await deleteImage(user?.photo);
  }

  console.log("req", req.body)
  const updatedUser = await User.findByIdAndUpdate(user?._id, req.body, { new: true })

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  let user = await User.findById(id)

  res.status(200).json({
    status: 'success',
    data: user,
  });
});

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 400;
  const skip = (page - 1) * limit;

  const { role, search, noPagination } = req.query;

  let query = { role };

  if (role == 'all')
    query = {
      ...query,
      role: { $in: ['user', 'vibe-guide', 'teacher'] },
    };

  if (search && search != '')
    query = {
      ...query,
      $or: [
        { teacherName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { vibeGuideName: { $regex: search, $options: 'i' } },
      ],
    };

  const users =
    noPagination && noPagination == 'true'
      ? await User.find(query)
      : await User.find(query)
        .sort('-updatedAt -createdAt')
        .skip(skip)
        .limit(limit);

  res.status(200).json({
    status: 'success',
    results: users?.length || 0,
    data: users,
  });
});

exports.getAllUsersForAdmin = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 400;
  const skip = (page - 1) * limit;

  const { search, status, role} = req.query;

  let query = {...(role=="allUsers"?{role:{$in:['user','vendor','trader']}}:{role})}

  if (search && search != '')
    query = {
      ...query,
      $or: [
        { email: { $regex: search, $options: 'i' } },
      ],
    };

  if (status == "all") {
    query = {
      ...query,
      isActive: { $in: [true, false] }
    }
  }
  else if (status == "active") {
    query = {
      ...query,
      isActive: true,
      isBlockedByAdmin:false
    }
  }
  else if (status == "blocked") {
    query = {
      ...query,
      isActive: true,
      isBlockedByAdmin:true
    }
  }
  else {
    query = {
      ...query,
      isActive: false
    }
  }

  console.log("🚀 ~ file: userController.js:135 ~ exports.getAllUsersForAdmin=catchAsync ~ query:", query)
  const users = await User.find(query).skip(skip).limit(limit);

  const [allUsers,allBuyers,allVendors,allTraders]=await Promise.all([
    User.countDocuments({role:{$in:['user','vendor','trader']}}),
    User.countDocuments({role:'user'}),
    User.countDocuments({role:'vendor'}),
    User.countDocuments({role:'trader'})
  ])

  res.status(200).json({
    status: 'success',
    results: users?.length || 0,
    allUsers,
    allBuyers,
    allVendors,
    allTraders,
    data: users,
  });
});

exports.activeDeactiveUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const status = req.body.status;
  console.log("🚀 ~ file: userController.js:158 ~ exports.activeDeactiveUser=catchAsync ~ status:", status)

  const user = await User.findByIdAndUpdate(id, { isBlockedByAdmin: status, }, { new: true });

  res.status(200).json({
    status: 'success',
    data: user,
  });
});