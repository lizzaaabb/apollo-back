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
  cloud_name: 'dkaxfyr33',
  api_key: '929791581171543',
  api_secret: 'pPdJB_mKQ_2dCn9LsXcgg_MR2PU',
});

// --- MONGODB CONFIGURATION ---
const MONGODB_URI = "mongodb+srv://apollo:apollo12@cluster0.knn3egt.mongodb.net/?appName=Cluster0";
const PORT = process.env.PORT || 5001;

// --- MONGOOSE SCHEMA ---

// Project Schema
const projectSchema = new mongoose.Schema({
  projectName: { type: String, required: true, trim: true },
  websiteLink: { type: String, required: true, trim: true },
  description: { type: String, required: false, trim: true },
  
  // Main picture (required)
  mainPictureUrl: { type: String, required: true },
  mainPicturePublicId: { type: String, required: true },
  
  // Additional pictures (optional, multiple)
  pictures: [{
    url: { type: String, required: true },
    publicId: { type: String, required: true }
  }],
  
  // Video (optional)
  videoUrl: { type: String, required: false },
  videoPublicId: { type: String, required: false },
  
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

// --- MODEL ---
const Project = mongoose.model('Project', projectSchema);

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
    folder: 'greenhall-projects',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
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

// --- CLOUDINARY MULTER SETUP FOR VIDEOS ---
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'greenhall-projects/videos',
    allowed_formats: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
    resource_type: 'video',
    public_id: (req, file) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
      return `${timestamp}-${safeName.split('.')[0]}`;
    },
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
    message: "Greenhall Projects Backend API ✅",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ========== PROJECT ROUTES ==========

// CREATE PROJECT
app.post("/projects", checkDbConnection, uploadImage.fields([
  { name: 'mainPicture', maxCount: 1 },
  { name: 'pictures', maxCount: 10 }
]), async (req, res) => {
  console.log('🎨 Project create request');
  
  try {
    const { projectName, websiteLink, description } = req.body;

    if (!projectName || !websiteLink) {
      return res.status(400).json({ 
        error: "Project name and website link are required" 
      });
    }

    if (!req.files || !req.files.mainPicture || req.files.mainPicture.length === 0) {
      return res.status(400).json({ 
        error: "Main picture is required" 
      });
    }

    const mainPicture = req.files.mainPicture[0];
    
    const additionalPictures = req.files.pictures || [];
    const picturesArray = additionalPictures.map(pic => ({
      url: pic.path,
      publicId: pic.filename
    }));

    const newProject = new Project({
      projectName: projectName.trim(),
      websiteLink: websiteLink.trim(),
      description: description?.trim() || '',
      mainPictureUrl: mainPicture.path,
      mainPicturePublicId: mainPicture.filename,
      pictures: picturesArray
    });

    await newProject.save();
    console.log(`✅ Project created: ${newProject._id}`);

    res.status(201).json({
      message: "Project created successfully!",
      project: newProject
    });

  } catch (error) {
    console.error('❌ Error creating project:', error);
    res.status(500).json({ error: "Failed to create project", details: error.message });
  }
});

// UPLOAD VIDEO TO EXISTING PROJECT
app.post("/projects/:id/video", checkDbConnection, uploadVideo.single('video'), async (req, res) => {
  console.log('🎥 Video upload request for project');
  
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Video file is required" });
    }

    if (project.videoPublicId) {
      await safeCloudinaryDestroy(project.videoPublicId, 'video');
    }

    project.videoUrl = req.file.path;
    project.videoPublicId = req.file.filename;

    await project.save();
    console.log(`✅ Video uploaded to project: ${req.params.id}`);

    res.json({
      message: "Video uploaded successfully!",
      project
    });

  } catch (error) {
    console.error('❌ Error uploading video:', error);
    res.status(500).json({ error: "Failed to upload video", details: error.message });
  }
});

// GET ALL PROJECTS
app.get("/projects", checkDbConnection, async (req, res) => {
  try {
    const projects = await Project.find().sort({ uploadDate: -1 });
    res.json({ projects });
  } catch (error) {
    console.error('❌ Error fetching projects:', error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// GET SINGLE PROJECT
app.get("/projects/:id", checkDbConnection, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json({ project });
  } catch (error) {
    console.error('❌ Error fetching project:', error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// UPDATE PROJECT
app.put("/projects/:id", checkDbConnection, uploadImage.fields([
  { name: 'mainPicture', maxCount: 1 },
  { name: 'pictures', maxCount: 10 }
]), async (req, res) => {
  try {
    const { projectName, websiteLink, description } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (projectName) project.projectName = projectName.trim();
    if (websiteLink) project.websiteLink = websiteLink.trim();
    if (description !== undefined) project.description = description.trim();

    if (req.files && req.files.mainPicture && req.files.mainPicture.length > 0) {
      await safeCloudinaryDestroy(project.mainPicturePublicId);
      const mainPicture = req.files.mainPicture[0];
      project.mainPictureUrl = mainPicture.path;
      project.mainPicturePublicId = mainPicture.filename;
    }

    if (req.files && req.files.pictures && req.files.pictures.length > 0) {
      for (const pic of project.pictures) {
        await safeCloudinaryDestroy(pic.publicId);
      }
      
      const newPictures = req.files.pictures.map(pic => ({
        url: pic.path,
        publicId: pic.filename
      }));
      project.pictures = newPictures;
    }

    await project.save();
    console.log(`✅ Project updated: ${req.params.id}`);

    res.json({ message: "Project updated successfully", project });
  } catch (error) {
    console.error('❌ Error updating project:', error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE PROJECT
app.delete("/projects/:id", checkDbConnection, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    await safeCloudinaryDestroy(project.mainPicturePublicId);
    
    for (const pic of project.pictures) {
      await safeCloudinaryDestroy(pic.publicId);
    }
    
    if (project.videoPublicId) {
      await safeCloudinaryDestroy(project.videoPublicId, 'video');
    }

    await Project.findByIdAndDelete(req.params.id);
    console.log(`✅ Project deleted: ${req.params.id}`);

    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting project:', error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// DELETE VIDEO FROM PROJECT
app.delete("/projects/:id/video", checkDbConnection, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.videoPublicId) {
      await safeCloudinaryDestroy(project.videoPublicId, 'video');
      project.videoUrl = null;
      project.videoPublicId = null;
      await project.save();
      console.log(`✅ Video deleted from project: ${req.params.id}`);
    }

    res.json({ message: "Video deleted successfully", project });
  } catch (error) {
    console.error('❌ Error deleting video:', error);
    res.status(500).json({ error: "Failed to delete video" });
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

// --- SERVER START & DB CONNECTION (FIXED) ---
const startServer = async () => {
  try {
    // Connect to MongoDB FIRST
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully!');
    
    // THEN start the server after DB is connected
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Greenhall Projects Server Running!`);
      console.log(`🌐 Server listening on port ${PORT}`);
      console.log(`\n📋 Endpoints:`);
      console.log(' Projects: POST/GET/PUT/DELETE /projects');
      console.log(' Upload Video: POST /projects/:id/video');
      console.log(' Delete Video: DELETE /projects/:id/video');
    });

    // Graceful shutdown handler
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

  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
};

// --- MONGOOSE CONNECTION EVENT HANDLERS ---
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully!');
});

// Start the application
startServer();