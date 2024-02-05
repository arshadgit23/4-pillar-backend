const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const compression = require('compression');
const cors = require('cors');
const User = require('./models/userModel');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const userRouter = require('./routes/userRoutes');
const NotificationsRouter = require('./routes/notificationRoutes');
const privacyPolicyRouter = require('./routes/privacyPolicyRoutes');
const termsAndConditionsRouter = require('./routes/termsAndConditionsRoutes');
const categoriesRouter = require('./routes/categoryRoutes');
const subCategoriesRouter = require('./routes/subCategoryRoutes');
const subSubCategoriesRouter = require('./routes/subSubCategoryRoutes');
const productRouter = require('./routes/productRoutes');
const agriculturalServiceCategoriesRouter = require('./routes/agriculturalServiceCategoryRoutes');
const tradesRouter = require('./routes/tradeRoutes');
const agriculturalServicesRouter = require('./routes/agriculturalServiceRoutes');
const shippingDetailsRouter = require('./routes/shippingDetailRoutes');
const reviewsRouter = require('./routes/reviewRoutes');
const productOrderRouter = require('./routes/productOrderRoutes');
const serviceOrderRouter = require('./routes/serviceOrderRoutes');
const bannerRouter = require('./routes/bannerRoutes');
const chatRouter = require('./routes/chatRoutes');
const Category = require('./models/categoryModel');
const Chat = require('./models/chatModel');
const Room = require('./models/roomModel');

// Start express app
// const app = express();
const app = require('express')();
const http = require('http').Server(app);
const io = require('./utils/socket').init(http);

app.enable('trust proxy');

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// PUG CONFIG
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// EJS CONFIG
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/public', '/templates'));

// 1) GLOBAL MIDDLEWARES
// Implement CORS
app.use(cors());

app.options('*', cors());
// app.options('/api/v1/tours/:id', cors());

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));

// Set security HTTP headers
// app.use(helmet());
app.use(helmet.frameguard({ action: 'SAMEORIGIN' }));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Category.updateMany({},{isDeleted:false}).then((rs) => console.log('Inserted !!'));

app.use(compression());

// 3) ROUTES
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to Kokoranch APIs',
  });
});

// read images
app.get('/api/images/:key', async (req, res) => {
  try {
    const key = req.params.key;

    if (req?.query?.type == 'pdf' || key?.split('.')[1] == 'pdf')
      res.header('Content-type', 'application/pdf');
    else if (key?.split('.')[1] == 'svg')
      res.set('Content-type', 'image/svg+xml');
    else res.set('Content-type', 'image/gif');

    // const readStream = await
    await getFileStream(key)
      .on('error', (e) => {
        // return res.status(404).json({
        //   message: 'Image not Found.',
        // });
      })
      .pipe(res);
  } catch (e) {
    return res.status(404).json({
      message: 'Image not found',
    });
  }
});

app.use('/api/v1/users', userRouter);
app.use('/api/v1/notifications', NotificationsRouter);
app.use('/api/v1/privacyPolicy', privacyPolicyRouter);
app.use('/api/v1/termsAndConditions', termsAndConditionsRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/sub-categories', subCategoriesRouter);
app.use('/api/v1/sub-sub-categories', subSubCategoriesRouter);
app.use('/api/v1/products', productRouter);
app.use('/api/v1/agricultural-services-categories', agriculturalServiceCategoriesRouter);
app.use('/api/v1/trades', tradesRouter);
app.use('/api/v1/agricultural-services', agriculturalServicesRouter);
app.use('/api/v1/shipping-details', shippingDetailsRouter);
app.use('/api/v1/reviews', reviewsRouter);
app.use('/api/v1/product-orders',productOrderRouter);
app.use('/api/v1/service-orders',serviceOrderRouter);
app.use('/api/v1/banners',bannerRouter);
app.use('/api/v1/chats',chatRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

// setting up

io.on('connection', (socket) => {
  // when user joins the app
  socket.on('join', async (id) => {
    console.log('joined', id);
    const authId = id;
    const socketId = socket.id;
    const filter = { _id: authId };
    const update = { socketId: socketId, isOnline: true };

    try {
      await User.findOneAndUpdate(filter, update, {
        new: true,
      });
    } catch (e) {
      console.log('Task failed successfully... 🧐🧐🧐', e);
    }
  });

  // when user enters in the room---> chat
  socket.on('chatJoin', async (id, roomId) => {
    try {
      console.log("🚀 ~ file: app.js:146 ~ socket.on ~ id:", id)
      console.log("🚀 ~ file: app.js:146 ~ socket.on ~ roomId:", roomId)
      const userId = id;
      await Chat.updateMany({ to: userId, room: roomId }, { isReadMessage: 1 });
    } catch (e) {
      console.log('Task failed successfully... 🧐🧐🧐', e);
    }
  });

  //user sends image in chat
  socket.on(
    'image',
    // uploadUserPhoto,
    async (msg, msgTo, from, roomId, role, imgType) => {
      const receiverId = msgTo;
      let receiverUser;
      let lastMessage;

      console.log(msg, 'msg');

      // const __rs = await uploadbase64File(base64Data);
      const __rs = await uploadbase64File(msg.message?.image, imgType);

      const urr = `https://${socket.handshake.headers.host}/api/images/${__rs.key}`;

      console.log(urr, 'urr');

      msg.message.image = urr;
      msg.message.mediaType = imgType;

      console.log(msg.message, 'msg.message');

      try {
        lastMessage = await Chat.findOne({ roomId }).sort('-createdAt');
        let sms = await Chat.create({
          message: msg.message,
          room: roomId,
          to: msgTo,
          from,
          isReadMessage: 0,
        });
        //mail

        receiverUser = await User.findById(receiverId);

        io.emit('msg', sms?.message, roomId);
      } catch (e) {
        console.log('msg submit error', e);
      }
    }
  );

  // on disconnect
  socket.on('disconnected', async (id, role = 'user') => {
    try {
      const authId = id;
      const filter = { _id: authId };
      const update = { isOnline: false };

      await User.findOneAndUpdate(filter, update, {
        new: true,
      });
    } catch (e) {
      console.log('error in disconnecting', e);
    }
  });

  // mark-as-read
  socket.on('mark-as-read', async (roomId, role) => {
    console.log("🚀 ~ file: app.js:218 ~ socket.on ~ role:", role)
    console.log("🚀 ~ file: app.js:218 ~ socket.on ~ roomId:", roomId)
    
    if (role != 'user') {
      await Room.findByIdAndUpdate(roomId, {
        user1UnreadCount: 0,
      });
    } else {
      await Room.findByIdAndUpdate(roomId, {
        user2UnreadCount: 0,
      });
    }
  });

  // for messeging
  socket.on('msg', async (msg, msgTo, roomId, currentUser = 'user') => {
    try {
      console.log('msg', msg, msgTo, roomId, currentUser);
      let receiverId = msgTo;
      const receiverUser = await User.findById(receiverId);
      let sender = null;
      const newMessage = new Chat({
        room: roomId,
        to: receiverUser._id,
        from: msg.user._id, // from UserId
        message: msg,
        isReadMessage: receiverUser.isOnline == null ? 0 : 1,
      });

      // update room => readCount
      if (currentUser == 'admin' || currentUser == 'vendor' || currentUser== 'trader') {
        await Room.findByIdAndUpdate(
          roomId,
          {
            lastMessage: msg,
            user1UnreadCount: 0,
            lastChatted: new Date(),
            $inc: { user2UnreadCount: 1 },
          },
          { new: true }
        );
      } else {
        await Room.findByIdAndUpdate(
          roomId,
          {
            lastMessage: msg,
            user2UnreadCount: 0,
            lastChatted: new Date(),
            $inc: { user1UnreadCount: 1 },
          },
          { new: true }
        );
      }

      await newMessage.save();

      console.log('msg', msg, 'roomid', roomId);

      // io.emit('msg', msg, roomId);
      io.to(receiverUser.socketId).emit('msg', msg, roomId);
    } catch (e) {
      console.log(e, 'msg submit error');
    }
  });

  //logout socket
  socket.on('logout', async (id, fcmToken) => {
    try {
      await User.findByIdAndUpdate(
        id,
        { $pull: { fcmToken } ,isOnline:false},
        {
          new: true,
        }
      );
    } catch (e) {
      console.log('Error in disconnecting', e);
    }
  });
});

exports.http = http;
