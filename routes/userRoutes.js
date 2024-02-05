const express = require('express');
const userController = require('./../controllers/userController');
const authController = require('./../controllers/authController');
const { uploadUserImage } = require('../utils/s3');
const {attachedPaymentMethod,deattachPaymentMethod,getPaymentMethods} = require('../utils/stripe');

const router = express.Router();

//signup and login apis
router.post('/signup',uploadUserImage,authController.signup);

//users use this api to login into the dashboard
router.post('/login', authController.login);

//admin use this api to login into dashboard
router.post('/admin-login', authController.adminLogin);

//forgot password and reset apis
router.post('/forgotPassword', authController.forgotPassword);

//reset password with token from params to get the user in api
router.get('/resetPassword/:token', authController.resetPassword);

//when you forgot password hit this api after that to set new password
router.post('/resetPasswordDone', authController.resetPasswordDone);

//when signup email sends you email hit this url on email template url
router.get('/verify-me/:id', authController.verifyMe);

//when user forgots password hit this api on 2nd step
router.post('/verify-forgot-password-otp', authController.verifyForgotPasswordOtp);

//get another user detail api
router.route('/detail/:id').get(userController.getUser)

//get all users public api
router.route('/').get(userController.getAllUsers);

// Protect all routes after this middleware with token
router.use(authController.protect);

//user can his profile data from his own token
router.get('/me', authController.me);

//user can his profile data from his own token
router.get('/my/favourites', authController.myFavourites);

//admin panel statistics api
router.get('/statistics', authController.statistics);

//user can resend otp to his email
router.post('/resend-otp', authController.resendOtp);

//logout api
router.post('/logout', authController.logout);

//update password api
router.patch('/updateMyPassword', authController.updatePassword);

//update me api
router.patch('/updateMe',uploadUserImage,userController.updateMe);

/*  --------------------- STRIPE ---------------------  */
router.route('/attach-payment-method').post(authController.restrictTo('user'),attachedPaymentMethod);

router.route('/detach-payment-method').post(authController.restrictTo('user'),deattachPaymentMethod);

router.route('/payment-method-list').get(authController.restrictTo('user'), getPaymentMethods);

router.use(authController.restrictTo('admin'));

router.route('/admin/all').get(userController.getAllUsersForAdmin);

router.route('/activate-deactivate/:id').patch(userController.activeDeactiveUser);

module.exports = router;