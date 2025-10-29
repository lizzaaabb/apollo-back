import express from "express";
import cors from "cors";
import multer from "multer";
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Helper function to safely destroy Cloudinary resource
const safeCloudinaryDestroy = async (publicId, resourceType = 'image') => {
  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (e) {
      console.warn(`Could not destroy Cloudinary asset ${publicId}:`, e);
    }
  }
};

// --- CLOUDINARY CONFIGURATION ---
cloudinary.config({
  cloud_name: 'dzeyg0jwq',
  api_key: '534685122381774',
  api_secret: 'IzTyJJlANKKpwJii5IJe2jK_vvw',
});

// --- MONGODB CONFIGURATION ---
const MONGODB_URI = "mongodb+srv://nursetoday2_db_user:NurseTodayWeb@cluster0.36qvdnf.mongodb.net/nursetoday2?retryWrites=true&w=majority&appName=Cluster0";
const PORT = process.env.PORT || 5001;

// --- MONGOOSE SCHEMAS ---

// 1. Testimonials Schema - IMAGE NOW OPTIONAL
const testimonialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  testimonial: { type: String, required: true, trim: true },
  stars: { type: Number, min: 0, max: 5, default: 0 },
  imageUrl: { type: String, required: false }, // Changed to optional
  imagePublicId: { type: String, required: false }, // Changed to optional
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

// 2. Home Page Video Schema
const homeVideoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  videoUrl: { type: String, required: true },
  videoPublicId: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

// 3. Services for Home Page Schema - ICON NOW OPTIONAL
const homeServiceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  iconUrl: { type: String, required: false }, // Changed to optional
  iconPublicId: { type: String, required: false }, // Changed to optional
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

// 4. Services Separate Page Schema
const servicePageSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  imageUrl: { type: String, required: true },
  imagePublicId: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

// 5. About Us Video Schema
const aboutVideoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  videoUrl: { type: String, required: true },
  videoPublicId: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

// 6. Address Schema
const addressSchema = new mongoose.Schema({
  address: { type: String, required: true, trim: true },
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

// 7. Social Media Links Schema
const socialLinkSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  link: { type: String, required: true, trim: true },
  iconUrl: { type: String, required: true },
  iconPublicId: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

// 8. Blog Post Schema - IMAGE AND DATE OPTIONAL
const blogPostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true, trim: true },
  imageUrl: { type: String, required: false },
  imagePublicId: { type: String, required: false },
  postDate: { type: Date, required: false },
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

// --- MODELS ---
const Testimonial = mongoose.model('Testimonial', testimonialSchema);
const HomeVideo = mongoose.model('HomeVideo', homeVideoSchema);
const HomeService = mongoose.model('HomeService', homeServiceSchema);
const ServicePage = mongoose.model('ServicePage', servicePageSchema);
const AboutVideo = mongoose.model('AboutVideo', aboutVideoSchema);
const Address = mongoose.model('Address', addressSchema);
const SocialLink = mongoose.model('SocialLink', socialLinkSchema);
const BlogPost = mongoose.model('BlogPost', blogPostSchema);

// --- EXPRESS APP SETUP ---
const app = express();

// --- MIDDLEWARE ---
app.use(cors({
  origin: '*',
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// --- DATABASE CONNECTION CHECK MIDDLEWARE ---
const checkDbConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ 
      error: "Database unavailable", 
      message: "MongoDB connection is not ready. Please try again later." 
    });
  }
  next();
};

// --- CLOUDINARY MULTER SETUP FOR IMAGES ---
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'apollo-creations',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp', 'svg'],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
      return `${timestamp}-${safeName.split('.')[0]}`;
    },
  }
});

// --- CLOUDINARY MULTER SETUP FOR VIDEOS ---
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'apollo-creations/videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
      return `${timestamp}-${safeName.split('.')[0]}`;
    },
  }
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  }
});

// --- ROUTES ---

app.get("/", (req, res) => {
  res.json({
    message: "Apollo Creations Backend API ✅",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ========== TESTIMONIALS ROUTES - IMAGE NOW OPTIONAL ==========

app.post("/testimonials/upload", checkDbConnection, uploadImage.single("image"), async (req, res) => {
  console.log('💬 Testimonial upload request');
  
  try {
    const { name, testimonial, stars } = req.body;

    if (!name || !testimonial) {
      return res.status(400).json({ error: "Name and testimonial are required" });
    }

    // Handle optional image
    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      imageUrl = req.file.path;
      imagePublicId = req.file.filename;
      console.log('📷 Image uploaded for testimonial');
    } else {
      console.log('📝 Testimonial created without image');
    }

    const newTestimonial = new Testimonial({
      name: name.trim(),
      testimonial: testimonial.trim(),
      stars: stars ? parseInt(stars) : 0,
      imageUrl,
      imagePublicId,
    });

    await newTestimonial.save();
    console.log(`✅ Testimonial created: ${newTestimonial._id}`);

    res.status(201).json({
      message: "Testimonial created successfully!",
      testimonial: newTestimonial
    });

  } catch (error) {
    console.error('❌ Error creating testimonial:', error);
    res.status(500).json({ error: "Failed to create testimonial", details: error.message });
  }
});

app.get("/testimonials", checkDbConnection, async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ uploadDate: -1 });
    res.json({ testimonials });
  } catch (error) {
    console.error('❌ Error fetching testimonials:', error);
    res.status(500).json({ error: "Failed to fetch testimonials" });
  }
});

app.delete("/testimonials/:id", checkDbConnection, async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) {
      return res.status(404).json({ error: "Testimonial not found" });
    }

    // Only delete from Cloudinary if image exists
    if (testimonial.imagePublicId) {
      await safeCloudinaryDestroy(testimonial.imagePublicId);
    }
    
    await Testimonial.findByIdAndDelete(req.params.id);
    console.log(`✅ Testimonial deleted: ${req.params.id}`);

    res.json({ message: "Testimonial deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting testimonial:', error);
    res.status(500).json({ error: "Failed to delete testimonial" });
  }
});

// ========== HOME PAGE VIDEO ROUTES ==========

app.post("/home-video/upload", checkDbConnection, uploadVideo.single("video"), async (req, res) => {
  console.log('🎥 Home video upload request');
  
  if (!req.file) {
    return res.status(400).json({ error: "No video uploaded" });
  }

  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const newVideo = new HomeVideo({
      title: title.trim(),
      description: description?.trim() || '',
      videoUrl: req.file.path,
      videoPublicId: req.file.filename,
    });

    await newVideo.save();
    console.log(`✅ Home video created: ${newVideo._id}`);

    res.status(201).json({
      message: "Home video created successfully!",
      video: newVideo
    });

  } catch (error) {
    console.error('❌ Error creating home video:', error);
    res.status(500).json({ error: "Failed to create home video", details: error.message });
  }
});

app.get("/home-video", checkDbConnection, async (req, res) => {
  try {
    const videos = await HomeVideo.find().sort({ uploadDate: -1 });
    res.json({ videos });
  } catch (error) {
    console.error('❌ Error fetching home videos:', error);
    res.status(500).json({ error: "Failed to fetch home videos" });
  }
});

app.delete("/home-video/:id", checkDbConnection, async (req, res) => {
  try {
    const video = await HomeVideo.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Home video not found" });
    }

    await safeCloudinaryDestroy(video.videoPublicId, 'video');
    await HomeVideo.findByIdAndDelete(req.params.id);
    console.log(`✅ Home video deleted: ${req.params.id}`);

    res.json({ message: "Home video deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting home video:', error);
    res.status(500).json({ error: "Failed to delete home video" });
  }
});

// ========== HOME SERVICES ROUTES - ICON NOW OPTIONAL ==========

app.post("/home-services/upload", checkDbConnection, uploadImage.single("icon"), async (req, res) => {
  console.log('🏠 Home service upload request');
  
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    // Handle optional icon
    let iconUrl = null;
    let iconPublicId = null;

    if (req.file) {
      iconUrl = req.file.path;
      iconPublicId = req.file.filename;
      console.log('🎨 Icon uploaded for home service');
    } else {
      console.log('📝 Home service created without icon');
    }

    const newService = new HomeService({
      title: title.trim(),
      description: description.trim(),
      iconUrl,
      iconPublicId,
    });

    await newService.save();
    console.log(`✅ Home service created: ${newService._id}`);

    res.status(201).json({
      message: "Home service created successfully!",
      service: newService
    });

  } catch (error) {
    console.error('❌ Error creating home service:', error);
    res.status(500).json({ error: "Failed to create home service", details: error.message });
  }
});

app.get("/home-services", checkDbConnection, async (req, res) => {
  try {
    const services = await HomeService.find().sort({ uploadDate: -1 });
    res.json({ services });
  } catch (error) {
    console.error('❌ Error fetching home services:', error);
    res.status(500).json({ error: "Failed to fetch home services" });
  }
});

app.delete("/home-services/:id", checkDbConnection, async (req, res) => {
  try {
    const service = await HomeService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: "Home service not found" });
    }

    // Only delete from Cloudinary if icon exists
    if (service.iconPublicId) {
      await safeCloudinaryDestroy(service.iconPublicId);
    }
    
    await HomeService.findByIdAndDelete(req.params.id);
    console.log(`✅ Home service deleted: ${req.params.id}`);

    res.json({ message: "Home service deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting home service:', error);
    res.status(500).json({ error: "Failed to delete home service" });
  }
});

// ========== SERVICE PAGE ROUTES ==========

app.post("/services/upload", checkDbConnection, uploadImage.single("image"), async (req, res) => {
  console.log('🔧 Service page upload request');
  
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    const newService = new ServicePage({
      title: title.trim(),
      description: description.trim(),
      imageUrl: req.file.path,
      imagePublicId: req.file.filename,
    });

    await newService.save();
    console.log(`✅ Service page created: ${newService._id}`);

    res.status(201).json({
      message: "Service created successfully!",
      service: newService
    });

  } catch (error) {
    console.error('❌ Error creating service:', error);
    res.status(500).json({ error: "Failed to create service", details: error.message });
  }
});

app.get("/services", checkDbConnection, async (req, res) => {
  try {
    const services = await ServicePage.find().sort({ uploadDate: -1 });
    res.json({ services });
  } catch (error) {
    console.error('❌ Error fetching services:', error);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

app.delete("/services/:id", checkDbConnection, async (req, res) => {
  try {
    const service = await ServicePage.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    await safeCloudinaryDestroy(service.imagePublicId);
    await ServicePage.findByIdAndDelete(req.params.id);
    console.log(`✅ Service deleted: ${req.params.id}`);

    res.json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting service:', error);
    res.status(500).json({ error: "Failed to delete service" });
  }
});

// ========== ABOUT VIDEO ROUTES ==========

app.post("/about-video/upload", checkDbConnection, uploadVideo.single("video"), async (req, res) => {
  console.log('📹 About video upload request');
  
  if (!req.file) {
    return res.status(400).json({ error: "No video uploaded" });
  }

  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const newVideo = new AboutVideo({
      title: title.trim(),
      description: description?.trim() || '',
      videoUrl: req.file.path,
      videoPublicId: req.file.filename,
    });

    await newVideo.save();
    console.log(`✅ About video created: ${newVideo._id}`);

    res.status(201).json({
      message: "About video created successfully!",
      video: newVideo
    });

  } catch (error) {
    console.error('❌ Error creating about video:', error);
    res.status(500).json({ error: "Failed to create about video", details: error.message });
  }
});

app.get("/about-video", checkDbConnection, async (req, res) => {
  try {
    const videos = await AboutVideo.find().sort({ uploadDate: -1 });
    res.json({ videos });
  } catch (error) {
    console.error('❌ Error fetching about videos:', error);
    res.status(500).json({ error: "Failed to fetch about videos" });
  }
});

app.delete("/about-video/:id", checkDbConnection, async (req, res) => {
  try {
    const video = await AboutVideo.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "About video not found" });
    }

    await safeCloudinaryDestroy(video.videoPublicId, 'video');
    await AboutVideo.findByIdAndDelete(req.params.id);
    console.log(`✅ About video deleted: ${req.params.id}`);

    res.json({ message: "About video deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting about video:', error);
    res.status(500).json({ error: "Failed to delete about video" });
  }
});

// ========== ADDRESS ROUTES ==========

app.post("/address", checkDbConnection, async (req, res) => {
  console.log('📍 Address create request');
  
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    const newAddress = new Address({
      address: address.trim(),
    });

    await newAddress.save();
    console.log(`✅ Address created: ${newAddress._id}`);

    res.status(201).json({
      message: "Address created successfully!",
      address: newAddress
    });

  } catch (error) {
    console.error('❌ Error creating address:', error);
    res.status(500).json({ error: "Failed to create address", details: error.message });
  }
});

app.get("/address", checkDbConnection, async (req, res) => {
  try {
    const addresses = await Address.find().sort({ uploadDate: -1 });
    res.json({ addresses });
  } catch (error) {
    console.error('❌ Error fetching addresses:', error);
    res.status(500).json({ error: "Failed to fetch addresses" });
  }
});

app.put("/address/:id", checkDbConnection, async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    const updatedAddress = await Address.findByIdAndUpdate(
      req.params.id,
      { address: address.trim() },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(404).json({ error: "Address not found" });
    }

    console.log(`✅ Address updated: ${req.params.id}`);
    res.json({ message: "Address updated successfully", address: updatedAddress });
  } catch (error) {
    console.error('❌ Error updating address:', error);
    res.status(500).json({ error: "Failed to update address" });
  }
});

app.delete("/address/:id", checkDbConnection, async (req, res) => {
  try {
    const address = await Address.findByIdAndDelete(req.params.id);
    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    console.log(`✅ Address deleted: ${req.params.id}`);
    res.json({ message: "Address deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting address:', error);
    res.status(500).json({ error: "Failed to delete address" });
  }
});

// ========== SOCIAL LINKS ROUTES ==========

app.post("/social/upload", checkDbConnection, uploadImage.single("icon"), async (req, res) => {
  console.log('🔗 Social link upload request');
  
  if (!req.file) {
    return res.status(400).json({ error: "No icon uploaded" });
  }

  try {
    const { name, link } = req.body;

    if (!name || !link) {
      return res.status(400).json({ error: "Name and link are required" });
    }

    const newSocialLink = new SocialLink({
      name: name.trim(),
      link: link.trim(),
      iconUrl: req.file.path,
      iconPublicId: req.file.filename,
    });

    await newSocialLink.save();
    console.log(`✅ Social link created: ${newSocialLink._id}`);

    res.status(201).json({
      message: "Social link created successfully!",
      socialLink: newSocialLink
    });

  } catch (error) {
    console.error('❌ Error creating social link:', error);
    res.status(500).json({ error: "Failed to create social link", details: error.message });
  }
});

app.get("/social", checkDbConnection, async (req, res) => {
  try {
    const socialLinks = await SocialLink.find().sort({ uploadDate: -1 });
    res.json({ socialLinks });
  } catch (error) {
    console.error('❌ Error fetching social links:', error);
    res.status(500).json({ error: "Failed to fetch social links" });
  }
});

app.delete("/social/:id", checkDbConnection, async (req, res) => {
  try {
    const socialLink = await SocialLink.findById(req.params.id);
    if (!socialLink) {
      return res.status(404).json({ error: "Social link not found" });
    }

    await safeCloudinaryDestroy(socialLink.iconPublicId);
    await SocialLink.findByIdAndDelete(req.params.id);
    console.log(`✅ Social link deleted: ${req.params.id}`);

    res.json({ message: "Social link deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting social link:', error);
    res.status(500).json({ error: "Failed to delete social link" });
  }
});

// ========== BLOG POSTS ROUTES - IMAGE AND DATE OPTIONAL ==========

app.post("/blog/upload", checkDbConnection, uploadImage.single("image"), async (req, res) => {
  console.log('📝 Blog post upload request');
  
  try {
    const { title, content, postDate } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    // Handle optional image
    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      imageUrl = req.file.path;
      imagePublicId = req.file.filename;
      console.log('📷 Image uploaded for blog post');
    } else {
      console.log('📝 Blog post created without image');
    }

    const newBlogPost = new BlogPost({
      title: title.trim(),
      content: content.trim(),
      imageUrl,
      imagePublicId,
      postDate: postDate ? new Date(postDate) : undefined,
    });

    await newBlogPost.save();
    console.log(`✅ Blog post created: ${newBlogPost._id}`);

    res.status(201).json({
      message: "Blog post created successfully!",
      blogPost: newBlogPost
    });

  } catch (error) {
    console.error('❌ Error creating blog post:', error);
    res.status(500).json({ error: "Failed to create blog post", details: error.message });
  }
});

app.get("/blog", checkDbConnection, async (req, res) => {
  try {
    const blogPosts = await BlogPost.find().sort({ uploadDate: -1 });
    res.json({ blogPosts });
  } catch (error) {
    console.error('❌ Error fetching blog posts:', error);
    res.status(500).json({ error: "Failed to fetch blog posts" });
  }
});

app.get("/blog/:id", checkDbConnection, async (req, res) => {
  try {
    const blogPost = await BlogPost.findById(req.params.id);
    if (!blogPost) {
      return res.status(404).json({ error: "Blog post not found" });
    }
    res.json({ blogPost });
  } catch (error) {
    console.error('❌ Error fetching blog post:', error);
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
});

app.delete("/blog/:id", checkDbConnection, async (req, res) => {
  try {
    const blogPost = await BlogPost.findById(req.params.id);
    if (!blogPost) {
      return res.status(404).json({ error: "Blog post not found" });
    }

    // Only delete from Cloudinary if image exists
    if (blogPost.imagePublicId) {
      await safeCloudinaryDestroy(blogPost.imagePublicId);
    }
    
    await BlogPost.findByIdAndDelete(req.params.id);
    console.log(`✅ Blog post deleted: ${req.params.id}`);

    res.json({ message: "Blog post deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting blog post:', error);
    res.status(500).json({ error: "Failed to delete blog post" });
  }
});

// --- Global Error Handling ---
app.use((error, req, res, next) => {
  console.error('💥 Error:', error);

  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.message });
  }

  res.status(500).json({ error: error.message || 'Something went wrong!' });
});

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// --- SERVER START & DB CONNECTION ---
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Apollo Creations Server Running!`);
  console.log(`🌐 Server listening on port ${PORT}`);
  console.log(`\n📋 Endpoints:`);
  console.log(' Testimonials: POST/GET/DELETE /testimonials (image optional)');
  console.log(' Home Video: POST/GET/DELETE /home-video');
  console.log(' Home Services: POST/GET/DELETE /home-services (icon optional)');
  console.log(' Services Page: POST/GET/DELETE /services');
  console.log(' About Video: POST/GET/DELETE /about-video');
  console.log(' Address: POST/GET/PUT/DELETE /address');
  console.log(' Social Links: POST/GET/DELETE /social');
  console.log(' Blog Posts: POST/GET/DELETE /blog (image and date optional)');
  
  mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully!');
  })
  .catch(err => {
    console.error('❌ Initial MongoDB connection failed:', err.message);
  });
});

// --- MONGOOSE CONNECTION EVENT HANDLERS ---
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully!');
});

// --- GRACEFUL SHUTDOWN ---
const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (err) {
    console.error('❌ Error closing MongoDB connection:', err);
  }
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);