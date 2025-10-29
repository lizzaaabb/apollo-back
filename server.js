import express from "express";
import cors from "cors";
import multer from "multer";
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// ⚠️ WARNING: Hardcoded secrets retained as requested ⚠️

// --- CLOUDINARY CONFIGURATION ---
cloudinary.config({
  cloud_name: 'dyyypm22l',
  api_key: '682741534824659',
  api_secret: 'HeG3zam8KiiUV7JZ5gdJHzHAzuk',
});

// --- MONGODB CONFIGURATION ---
const MONGODB_URI = "mongodb+srv://bridge-the-gap:bridge-the-gap-10@cluster0.mi7wv1y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const PORT = process.env.PORT || 5001;

// --- MONGOOSE SCHEMAS ---

const programSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  images: [{
    cloudinaryUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    originalName: { type: String },
  }],
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

const partnerSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  cloudinaryUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, required: true },
  originalName: { type: String },
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

const shopItemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  cloudinaryUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, required: true },
  originalName: { type: String },
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

const socialLinkSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  link: { type: String, required: true, trim: true },
  cloudinaryUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, required: true },
  originalName: { type: String },
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

// NEW: Blog Post Schema - IMAGE AND DATE OPTIONAL
const blogPostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  text: { type: String, required: true, trim: true },
  date: { type: Date, required: false }, // Optional custom date
  cloudinaryUrl: { type: String, required: false },
  cloudinaryPublicId: { type: String, required: false },
  originalName: { type: String },
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

// NEW: PDF Document Schema
const pdfDocumentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  cloudinaryUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, required: true },
  originalName: { type: String },
  fileSize: { type: Number, required: false }, // in bytes
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

// --- MODELS ---
const Program = mongoose.model('Program', programSchema);
const Partner = mongoose.model('Partner', partnerSchema);
const ShopItem = mongoose.model('ShopItem', shopItemSchema);
const SocialLink = mongoose.model('SocialLink', socialLinkSchema);
const BlogPost = mongoose.model('BlogPost', blogPostSchema);
const PDFDocument = mongoose.model('PDFDocument', pdfDocumentSchema);

// --- EXPRESS APP SETUP ---
const app = express();

// --- MIDDLEWARE ---
app.use(cors({
  origin: '*',
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'bridge-the-gap',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp', 'svg'],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
      return `${timestamp}-${safeName.split('.')[0]}`;
    },
  }
});

// NEW: CLOUDINARY MULTER SETUP FOR PDFs
const pdfStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'bridge-the-gap/pdfs',
    resource_type: 'raw',
    allowed_formats: ['pdf'],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
      return `${timestamp}-${safeName.split('.')[0]}`;
    },
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const uploadPDF = multer({
  storage: pdfStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for PDFs
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

// --- ROUTES ---

app.get("/", (req, res) => {
  res.json({
    message: "Bridge The Gap Backend API ✅",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ========== PROGRAMS/GALLERY ROUTES ==========

app.post("/programs/upload", checkDbConnection, upload.array("images", 10), async (req, res) => {
  console.log('📸 Program upload request');
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No images uploaded" });
  }

  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    const images = req.files.map(file => ({
      cloudinaryUrl: file.path,
      cloudinaryPublicId: file.filename,
      originalName: file.originalname,
    }));

    const newProgram = new Program({
      title: title.trim(),
      description: description.trim(),
      images
    });

    await newProgram.save();
    console.log(`✅ Program created: ${newProgram._id}`);

    res.status(201).json({
      message: "Program created successfully!",
      program: newProgram
    });

  } catch (error) {
    console.error('❌ Error creating program:', error);
    res.status(500).json({ error: "Failed to create program", details: error.message });
  }
});

app.get("/programs", checkDbConnection, async (req, res) => {
  try {
    const programs = await Program.find().sort({ uploadDate: -1 });
    res.json({ programs });
  } catch (error) {
    console.error('❌ Error fetching programs:', error);
    res.status(500).json({ error: "Failed to fetch programs" });
  }
});

app.get("/programs/:id", checkDbConnection, async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    if (!program) {
      return res.status(404).json({ error: "Program not found" });
    }
    res.json({ program });
  } catch (error) {
    console.error('❌ Error fetching program:', error);
    res.status(500).json({ error: "Failed to fetch program" });
  }
});

app.delete("/programs/:id", checkDbConnection, async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    if (!program) {
      return res.status(404).json({ error: "Program not found" });
    }

    // Delete all images from Cloudinary
    for (const image of program.images) {
      try {
        await cloudinary.uploader.destroy(image.cloudinaryPublicId);
      } catch (err) {
        console.error('Error deleting image from Cloudinary:', err);
      }
    }

    await Program.findByIdAndDelete(req.params.id);
    console.log(`✅ Program deleted: ${req.params.id}`);

    res.json({ message: "Program deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting program:', error);
    res.status(500).json({ error: "Failed to delete program" });
  }
});

// ========== PARTNERS ROUTES ==========

app.post("/partners/upload", checkDbConnection, upload.single("image"), async (req, res) => {
  console.log('🤝 Partner upload request');
  
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    const newPartner = new Partner({
      title: title.trim(),
      description: description.trim(),
      cloudinaryUrl: req.file.path,
      cloudinaryPublicId: req.file.filename,
      originalName: req.file.originalname,
    });

    await newPartner.save();
    console.log(`✅ Partner created: ${newPartner._id}`);

    res.status(201).json({
      message: "Partner created successfully!",
      partner: newPartner
    });

  } catch (error) {
    console.error('❌ Error creating partner:', error);
    res.status(500).json({ error: "Failed to create partner", details: error.message });
  }
});

app.get("/partners", checkDbConnection, async (req, res) => {
  try {
    const partners = await Partner.find().sort({ uploadDate: -1 });
    res.json({ partners });
  } catch (error) {
    console.error('❌ Error fetching partners:', error);
    res.status(500).json({ error: "Failed to fetch partners" });
  }
});

app.delete("/partners/:id", checkDbConnection, async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id);
    if (!partner) {
      return res.status(404).json({ error: "Partner not found" });
    }

    await cloudinary.uploader.destroy(partner.cloudinaryPublicId);
    await Partner.findByIdAndDelete(req.params.id);
    console.log(`✅ Partner deleted: ${req.params.id}`);

    res.json({ message: "Partner deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting partner:', error);
    res.status(500).json({ error: "Failed to delete partner" });
  }
});

// ========== SHOP ROUTES ==========

app.post("/shop/upload", checkDbConnection, upload.single("image"), async (req, res) => {
  console.log('🛍️ Shop item upload request');
  
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const newShopItem = new ShopItem({
      title: title.trim(),
      cloudinaryUrl: req.file.path,
      cloudinaryPublicId: req.file.filename,
      originalName: req.file.originalname,
    });

    await newShopItem.save();
    console.log(`✅ Shop item created: ${newShopItem._id}`);

    res.status(201).json({
      message: "Shop item created successfully!",
      shopItem: newShopItem
    });

  } catch (error) {
    console.error('❌ Error creating shop item:', error);
    res.status(500).json({ error: "Failed to create shop item", details: error.message });
  }
});

app.get("/shop", checkDbConnection, async (req, res) => {
  try {
    const shopItems = await ShopItem.find().sort({ uploadDate: -1 });
    res.json({ shopItems });
  } catch (error) {
    console.error('❌ Error fetching shop items:', error);
    res.status(500).json({ error: "Failed to fetch shop items" });
  }
});

app.delete("/shop/:id", checkDbConnection, async (req, res) => {
  try {
    const shopItem = await ShopItem.findById(req.params.id);
    if (!shopItem) {
      return res.status(404).json({ error: "Shop item not found" });
    }

    await cloudinary.uploader.destroy(shopItem.cloudinaryPublicId);
    await ShopItem.findByIdAndDelete(req.params.id);
    console.log(`✅ Shop item deleted: ${req.params.id}`);

    res.json({ message: "Shop item deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting shop item:', error);
    res.status(500).json({ error: "Failed to delete shop item" });
  }
});

// ========== SOCIAL LINKS ROUTES ==========

app.post("/social/upload", checkDbConnection, upload.single("icon"), async (req, res) => {
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
      cloudinaryUrl: req.file.path,
      cloudinaryPublicId: req.file.filename,
      originalName: req.file.originalname,
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

    await cloudinary.uploader.destroy(socialLink.cloudinaryPublicId);
    await SocialLink.findByIdAndDelete(req.params.id);
    console.log(`✅ Social link deleted: ${req.params.id}`);

    res.json({ message: "Social link deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting social link:', error);
    res.status(500).json({ error: "Failed to delete social link" });
  }
});

// ========== BLOG POSTS ROUTES - IMAGE AND DATE OPTIONAL ==========

app.post("/blogs/upload", checkDbConnection, upload.single("image"), async (req, res) => {
  console.log('📝 Blog post upload request');
  
  try {
    const { title, text, date } = req.body;

    if (!title || !text) {
      return res.status(400).json({ error: "Title and text are required" });
    }

    let cloudinaryUrl = null;
    let cloudinaryPublicId = null;
    let originalName = null;

    if (req.file) {
      cloudinaryUrl = req.file.path;
      cloudinaryPublicId = req.file.filename;
      originalName = req.file.originalname;
      console.log('📷 Image uploaded for blog post');
    } else {
      console.log('📝 Blog post created without image');
    }

    const blogData = {
      title: title.trim(),
      text: text.trim(),
      cloudinaryUrl,
      cloudinaryPublicId,
      originalName,
    };

    // Only add date if provided
    if (date && date.trim()) {
      blogData.date = new Date(date);
    }

    const newBlogPost = new BlogPost(blogData);

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

app.get("/blogs", checkDbConnection, async (req, res) => {
  try {
    const blogPosts = await BlogPost.find().sort({ uploadDate: -1 });
    res.json({ blogPosts });
  } catch (error) {
    console.error('❌ Error fetching blog posts:', error);
    res.status(500).json({ error: "Failed to fetch blog posts" });
  }
});

app.get("/blogs/:id", checkDbConnection, async (req, res) => {
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

app.delete("/blogs/:id", checkDbConnection, async (req, res) => {
  try {
    const blogPost = await BlogPost.findById(req.params.id);
    if (!blogPost) {
      return res.status(404).json({ error: "Blog post not found" });
    }

    if (blogPost.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(blogPost.cloudinaryPublicId);
      } catch (err) {
        console.error('Error deleting image from Cloudinary:', err);
      }
    }
    
    await BlogPost.findByIdAndDelete(req.params.id);
    console.log(`✅ Blog post deleted: ${req.params.id}`);

    res.json({ message: "Blog post deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting blog post:', error);
    res.status(500).json({ error: "Failed to delete blog post" });
  }
});

// ========== PDF DOCUMENTS ROUTES ==========

app.post("/pdfs/upload", checkDbConnection, uploadPDF.single("pdf"), async (req, res) => {
  console.log('📄 PDF upload request');
  
  if (!req.file) {
    return res.status(400).json({ error: "No PDF uploaded" });
  }

  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    const newPDF = new PDFDocument({
      title: title.trim(),
      description: description.trim(),
      cloudinaryUrl: req.file.path,
      cloudinaryPublicId: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
    });

    await newPDF.save();
    console.log(`✅ PDF document created: ${newPDF._id}`);

    res.status(201).json({
      message: "PDF document uploaded successfully!",
      pdf: newPDF
    });

  } catch (error) {
    console.error('❌ Error uploading PDF:', error);
    res.status(500).json({ error: "Failed to upload PDF", details: error.message });
  }
});

app.get("/pdfs", checkDbConnection, async (req, res) => {
  try {
    const pdfs = await PDFDocument.find().sort({ uploadDate: -1 });
    res.json({ pdfs });
  } catch (error) {
    console.error('❌ Error fetching PDFs:', error);
    res.status(500).json({ error: "Failed to fetch PDFs" });
  }
});

app.get("/pdfs/:id", checkDbConnection, async (req, res) => {
  try {
    const pdf = await PDFDocument.findById(req.params.id);
    if (!pdf) {
      return res.status(404).json({ error: "PDF not found" });
    }
    res.json({ pdf });
  } catch (error) {
    console.error('❌ Error fetching PDF:', error);
    res.status(500).json({ error: "Failed to fetch PDF" });
  }
});

app.delete("/pdfs/:id", checkDbConnection, async (req, res) => {
  try {
    const pdf = await PDFDocument.findById(req.params.id);
    if (!pdf) {
      return res.status(404).json({ error: "PDF not found" });
    }

    try {
      await cloudinary.uploader.destroy(pdf.cloudinaryPublicId, { resource_type: 'raw' });
    } catch (err) {
      console.error('Error deleting PDF from Cloudinary:', err);
    }
    
    await PDFDocument.findByIdAndDelete(req.params.id);
    console.log(`✅ PDF deleted: ${req.params.id}`);

    res.json({ message: "PDF deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting PDF:', error);
    res.status(500).json({ error: "Failed to delete PDF" });
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

// --- SERVER START & DB CONNECTION FIX ---
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Bridge The Gap Server Running!`);
  console.log(`🌐 Server listening on port ${PORT}`);
  console.log(`\n📋 Endpoints:`);
  console.log(' Programs: POST/GET/DELETE /programs');
  console.log(' Partners: POST/GET/DELETE /partners');
  console.log(' Shop: POST/GET/DELETE /shop');
  console.log(' Social: POST/GET/DELETE /social');
  console.log(' Blogs: POST/GET/DELETE /blogs');
  console.log(' PDFs: POST/GET/DELETE /pdfs');
  
  // 1. Start the server (Passes Render Health Check)
  
  // 2. Connect to MongoDB AFTER server is listening (Async)
  mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully!');
  })
  .catch(err => {
    // 3. Log error, but DO NOT call process.exit(1)
    console.error('❌ Initial MongoDB connection failed. Database functionality may be disabled:', err.message);
  });
});

// --- MONGOOSE CONNECTION EVENT HANDLERS ---
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully!');
});

// --- GRACEFUL SHUTDOWN (Best practice for Render) ---
const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  // Close DB connection
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (err) {
    console.error('❌ Error closing MongoDB connection:', err);
  }
  
  // Close server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown); // Ctrl+C
process.on('SIGTERM', shutdown); // Render shutdown signal