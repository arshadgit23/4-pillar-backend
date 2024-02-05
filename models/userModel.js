const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const ShippingDetailSchema = new mongoose.Schema(
  {
    itemLocation:{
      type:String
    },
    shippingTo:{
      type:String
    },
    delivery:{
      type:String
    },
    return:{
      type:String
    },
    shippingAndHandling:{
      type:String
    },
  }
);

const userSchema = new mongoose.Schema(
  {
    photo: {
      type: String,
    },
    storeName:{
      type:String
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    role: {
      type: String,
      enum: ['admin','user','vendor','trader'],
      default: 'user',
    },
    email: {
      type: String,
      // unique: true,
      // required: [true, 'Please provide your email'],
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email'],
      index: true,
    },
    phoneNumber: {
      type: String,
    },
    addressLine1: {
      type: String,
    },
    addressLine2: {
      type: String,
    },
    userType: {
      type: String,
      enum:["web","app"]
    },
    verificationCode: {
      type: String,
    }, 
    isActive: {
      type: Boolean,
      default: true,
    },
    isBlockedByAdmin: {
      type: Boolean,
      default:false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    favourites:{
      type:[{type:mongoose.Schema.Types.ObjectId,ref:"Product"}]
    },
    password: {
      type: String,
      minlength: 8,
      select: false,
    },
    passwordConfirm: {
      type: String,
      // required: [true, 'Please confirm your password'],
      validate: {
        // This only works on CREATE and SAVE!!!
        validator: function (el) {
          return el === this.password;
        },
        message: 'Passwords are not the same!',
      },
    },
    passwordResetCode: {
      type: Number,
      default: 0,
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    isOnline: {
      type: Boolean,
      default: false,
    },
    socketId: {
      type:String
    },
    cus: {
      type: String,
      // required: [true, 'stripe customer id is required.'],
    },
    lastLogin: {
      type: Date,
      default: Date.now(),
    },
    lastLogin: {
      type: Date,
      default: Date.now(),
    },
    shippingDetails:{
      type:ShippingDetailSchema
    },
  },
  {
    timestamps: true,
  }
);

userSchema.set('toObject', { virtuals: true });
userSchema.set('toJSON', { virtuals: true });

userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return JWTTimestamp < changedTimestamp;
  }

  // False means NOT changed
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
