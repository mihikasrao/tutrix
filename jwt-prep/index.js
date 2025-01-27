const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { expressjwt } = require('express-jwt');
require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use(express.urlencoded({ extended: true })); 
const ejs = require('ejs');

app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
const dayjs = require('dayjs');


const multer = require('multer');




const jwtSecret = process.env.JWT_SECRET;
const auth0Issuer = process.env.ISSUER;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Successfully connected to MongoDB"))
    .catch((error) => console.error("Error connecting to MongoDB:", error));

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    group: String,
    auth_provider: String,
    auth_id: String,
    password: String 
});
const User = mongoose.model('User', userSchema);

const userProfileSchema = new mongoose.Schema({
    profilePicture: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    graduationYear: Number,
    major: String,
    interests: [String],
    learningStyles: [String],
    completedSessions: { type: Number, default: 0 },
    upcomingLessons: [
        {
            tutor: String, 
            date: String
        }
    ]

});

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

const tutorProfileSchema = new mongoose.Schema({
    profilePicture: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    email: { type: String, unique: true },
    subjects: [String],
    upcomingLessons: { type: Number, default: 0 },  
    learningStyles: [String],
    availability: [{ date: String, time: String }],
    rating: { type: Number, default: 0 },
    completedSessions: { type: Number, default: 0 },
    location: { 
        lat: { type: Number, required: false },
        lon: { type: Number, required: false },
        lastUpdated: { type: Date, default: null }
    },
    subjects: [String],
    isAvailable: { type: Boolean, default: false },
    onDemand: { type: Boolean, default: false },
    bio: String
});

const TutorProfile = mongoose.model('TutorProfile', tutorProfileSchema);



const tutorAvailabilitySchema = new mongoose.Schema({
    tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorProfile', required: true }, // Reference to TutorProfile,
    tutorName: String,
    date: { type: Date, required: true },
    time: String,
    createdAt: { type: Date, default: Date.now }
});
  
const TutorAvailability = mongoose.model('TutorAvailability', tutorAvailabilitySchema);

const studentTutorAssignmentSchema = new mongoose.Schema({
    tutorId: String,
    tutorName: String,
    studentId: String,
    studentName: String,
    date: String,
    time: String,
    reason: String,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});
  
const StudentTutorAssignment = mongoose.model('StudentTutorAssignment', studentTutorAssignmentSchema);

const adminStudentTutorAssignmentSchema = new mongoose.Schema({
    tutorId: String,
    tutorName: String,
    studentId: String,
    studentName: String,
    date: String,
    time: String,
    createdAt: { type: Date, default: Date.now }
  });
  
const AdminStudentTutorAssignment = mongoose.model('AdminStudentTutorAssignment', adminStudentTutorAssignmentSchema);

const reportSchema = new mongoose.Schema({
    reportType: String, 
    generatedBy: String, 
    targetPeople: [{ name: String, email: String, group: String }], 
    reportContent: String, 
    createdAt: { type: Date, default: Date.now }
  });
  
const Report = mongoose.model('Report', reportSchema);
  
const jwtAuth = expressjwt({
    secret: jwtSecret,
    algorithms: ['HS256'],
    getToken: (req) => req.cookies.jwt,
}).unless({ path: ['/login', '/callback', '/signup', '/', '/group-selection', '/set-group', '/tutor-login'] });

app.use(jwtAuth);

// Routes

//for picture upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/'); // Save uploads to the "uploads" directory
    },
    filename: (req, file, cb) => {
        cb(null, `${req.auth.email}-${Date.now()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|gif/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    },
    limits: { fileSize: 2 * 1024 * 1024 }, 
});


async function addTutor() {
    const name = 'Billy Tutor';
    const email = 'billy-tutor@gmail.com';
    const plainPassword = 'password123';

    try {
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        const newTutor = new User({
            name,
            email,
            group: 'Tutor',
            auth_provider: 'Auth0',
            auth_id: 'auth0|670fec71166ef02b12e7998b',
            password: hashedPassword,
        });

        await newTutor.save();
        console.log('Tutor added successfully:', newTutor);

        const tutorProfile = new TutorProfile({
            userId: newTutor._id,
            subjects: ['Mathematics', 'Physics'],
            email: newTutor.email,
            learningStyles: ["online-tutor", "homework-help"],
            bio: 'Experienced tutor with 5 years of teaching.'
        });
        
        await tutorProfile.save();
    } catch (error) {
        console.error('Error adding tutor:', error);
    }
}


app.get('/', (req, res) => {
    res.render('signup'); 
});

const bcrypt = require('bcrypt');

app.post('/signup', (req, res) => {
    const authUrl = `${auth0Issuer}/authorize?response_type=code&client_id=${clientId}&redirect_uri=http://localhost:3000/callback&scope=openid profile email&prompt=login`;
    res.redirect(authUrl);
});

app.get('/tutor-login', (req, res) => {
    res.render('login-tutor'); 
});

app.get('/home', jwtAuth, (req, res) => {
    res.render('home');
});


app.post('/tutor-login', async (req, res) => {
    const { email, password } = req.body;
    console.log("in tutor login"); 
    //addTutor(); 
    try {
        const tutor = await User.findOne({ email, group: 'Tutor' });
        if (!tutor) {
            return res.status(400).render('login-tutor', {
                error: 'Invalid email or password.',
            });
        }

        console.log('Tutor found:', tutor);

        const passwordMatch = await bcrypt.compare(password, tutor.password);
        if (!passwordMatch) {
            return res.status(400).render('login-tutor', {
                error: 'Invalid email or password.',
            });
            //return res.status(401).send('Invalid credentials');
        }

        console.log('Login attempt:', { email, password });

        const token = jwt.sign(
            { name: tutor.name, email: tutor.email, group: tutor.group, userId: tutor._id  },
            jwtSecret,
            { expiresIn: '1h' }
        );

        res.cookie('jwt', token, { httpOnly: true });
        res.redirect('/home');
    } catch (error) {
        console.error('Error during tutor login:', error);
        res.status(500).send('Internal server error');
    }
});

app.get('/login', (req, res) => {
    res.render('login'); 
});

app.post('/login', (req, res) => {
    const authUrl = `${auth0Issuer}/authorize?response_type=code&client_id=${clientId}&redirect_uri=http://localhost:3000/callback&scope=openid profile email`;
    res.redirect(authUrl); 
});

app.post('/signup', (req, res) => {
    const authUrl = `${auth0Issuer}/authorize?response_type=code&client_id=${clientId}&redirect_uri=http://localhost:3000/callback&scope=openid profile email&prompt=login`;
    res.redirect(authUrl);
});


app.get('/callback', async (req, res) => {
    const { code } = req.query;
    const tokenUrl = `${auth0Issuer}/oauth/token`;

    try {
        const tokenResponse = await axios.post(tokenUrl, {
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: 'http://localhost:3000/callback',
        });

        const { id_token } = tokenResponse.data;
        const userInfo = jwt.decode(id_token);

        let user = await User.findOne({ email: userInfo.email });

        if (!user) {
            user = new User({
                name: userInfo.name,
                email: userInfo.email,
                group: 'Student',
                auth_provider: 'Auth0',
                auth_id: userInfo.sub,
            });

            await user.save();
            res.cookie('tempUser', JSON.stringify(user), { httpOnly: true });
            return res.redirect('/group-selection');
        } else {
            const token = jwt.sign({ name: user.name, email: user.email, group: user.group }, jwtSecret, { expiresIn: '1h' });
            res.cookie('jwt', token, { httpOnly: true });
            return res.redirect('/home');
        }
    } catch (error) {
        console.error('Error during callback:', error);
        res.status(500).send('Authentication failed');
    }
});


app.get('/group-selection', (req, res) => {
    const tempUser = req.cookies.tempUser ? JSON.parse(req.cookies.tempUser) : null;

    if (!tempUser) {
        return res.redirect('/login'); 
    }

    res.render('group-selection', { user: tempUser });
});

app.post('/group-selection', async (req, res) => {
    const tempUser = req.cookies.tempUser ? JSON.parse(req.cookies.tempUser) : null;

    if (!tempUser) {
        return res.redirect('/login');
    }

    const { graduationYear, major, interests, learningStyles } = req.body;

    try {
        const userProfile = new UserProfile({
            userId: tempUser._id,
            graduationYear,
            major,
            interests: interests.split(',').map((interest) => interest.trim()),
            learningStyles: learningStyles.split(',').map((learn) => learn.trim()),
        });

        await userProfile.save();
        res.clearCookie('tempUser');

        console.log(userProfile); 
        const token = jwt.sign(
            { name: tempUser.name, email: tempUser.email, group: 'Student' },
            jwtSecret,
            { expiresIn: '1h' }
        );

        res.cookie('jwt', token, { httpOnly: true });
        res.redirect('/profile');
    } catch (error) {
        console.error('Error saving profile:', error);
        res.status(500).send('Internal server error');
    }
});

app.get('/profile', jwtAuth, async (req, res) => {
    const { email } = req.auth;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.redirect('/login');
        }

        // If the user is a student, fetch the student profile
        if (user.group === 'Student') {
            let userProfile = await UserProfile.findOne({ userId: user._id.toString() });

            if (!userProfile) {
                // Default student profile
                userProfile = {
                    graduationYear: 'N/A',
                    major: 'N/A',
                    interests: [],
                    learningStyles: [],
                    completedSessions: 0,
                    upcomingLessons: [],

                };
            }

            return res.render('studentprofile', { user, profile: userProfile });
        }

        // If the user is a tutor, render the tutor profile
        if (user.group === 'Tutor') {
            let tutorProfile = await TutorProfile.findOne({ userId: user._id.toString() });
            if (!tutorProfile) {
                tutorProfile = {
                    subjects: [],
                    availability: [],
                    rating: 0,
                    completedSessions: 0,
                    bio: 'No bio available.',
                };
            }

            return res.render('tutorprofile', { user, profile: tutorProfile });
        }

        // Handle other user groups if necessary
        res.status(403).send('Forbidden: Unknown group');
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).send('Internal server error');
    }
});



app.get('/tasks', jwtAuth, async(req,res) => {
    console.log('Accessing /tasks route');
    if (!req.cookies.jwt) {
        console.log('No JWT found');
        return res.redirect('/login');
    }

    if (!req.auth) {
        return res.redirect('/login');
    }

    const user = req.auth; 

    if (user.group === 'Admin') {
        res.render('admin-dashboard', { user });
    } else if (user.group === 'User') {
        res.render('user-dashboard', { user });
    } else if (user.group === 'Tutor') {
        res.render('tutor-dashboard', { user });
    } else if (user.group === 'Student') {
        res.render('student-dashboard', { user });
    } else {
        res.status(403).send('Forbidden: Unknown group');
    }

});

//ADMIN SECTION
app.get('/availability', jwtAuth, async(req,res) => {
    console.log('Accessing /avail route');
    if (!req.cookies.jwt) {
        console.log('No JWT found');
        return res.redirect('/login');
    }

    if (!req.auth) {
        return res.redirect('/login');
    }

  
    try {
        const tutorAvailability = await TutorAvailability.find({});
        res.render('availability', { tutorAvailability });  
    } catch (error) {
        console.error('Error fetching tutor availability:', error);
        res.status(500).send('Internal server error');
    }
    
    
})

app.get('/schedule', jwtAuth, async (req, res) => {
    console.log('accessing schedule'); 

    if (!req.auth) {
        return res.redirect('/login');
    }

    console.log('accessing schedule1'); 

    const user = req.auth; 
    if (user.group === 'Admin') {
        try {
            const tutors = await User.find({ group: 'Tutor' });
            const students = await User.find({ group: 'Student' });

            res.render('schedule', { tutors, students });
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).send('Internal server error');
        }
    } else {
        res.status(403).send('Forbidden: Only Admins can schedule tasks');
    }
});

app.post('/schedule', jwtAuth, async (req, res) => {
    console.log("Admin requesting to schedule");
    
    const user = req.auth; 
    if (!user || user.group !== 'Admin') {
        return res.status(403).send('Forbidden: Only Admins can schedule tasks');
    }
    
    const { tutorId, studentId, date, time } = req.body;
    
    if (!tutorId && !studentId) {
        return res.status(400).send('Error: You must select either a tutor or a student.');
    }
    
    try {
        const tutor = tutorId ? await User.findById(tutorId) : null;
        const student = studentId ? await User.findById(studentId) : null;
        
        if (tutorId && !tutor) {
            return res.status(404).send('Tutor not found');
        }
        if (studentId && !student) {
            return res.status(404).send('Student not found');
        }
        
        const conflict = await StudentTutorAssignment.findOne({
            date,
            time,
            $or: [{ tutorId }, { studentId }]
        });
        
        if (conflict) {
            return res.render('schedule-conflict', { date, time });
        }
        
        const newSession = new AdminStudentTutorAssignment({
            tutorId,
            tutorName: tutor ? tutor.name : 'N/A',   
            studentId,
            studentName: student ? student.name : 'N/A',  
            date,
            time
        });
        
        await newSession.save();

        res.render('schedule-success', {
            tutorName: newSession.tutorName,
            studentName: newSession.studentName,
            date: newSession.date,
            time: newSession.time
        });

    } catch (error) {
        console.error("Error scheduling session:", error);
        return res.status(500).send('Internal server error');
    }
});

app.get('/users/:group', jwtAuth, async (req, res) => {
    const { group } = req.params;
    
    try {
        const users = await User.find({ group });
        res.json(users);  
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send("Internal server error");
    }
});


app.get('/report', jwtAuth, async (req, res) => {
    const user = req.auth;
  
    if (user && user.group === 'Admin') {
        res.render('report');
    } else {
        res.status(403).send('Forbidden: Only Admins can generate reports');
    }
});

app.post('/report', jwtAuth, async (req, res) => {
    const { reportType, individualId, reportContent } = req.body;
    let targetPeople = [];
    const user = req.auth;

    if (reportType === 'allTutors') {
        targetPeople = await User.find({ group: 'Tutor' }, 'name email group');
    } else if (reportType === 'allStudents') {
        targetPeople = await User.find({ group: 'Student' }, 'name email group');
    } else if (reportType === 'individualTutor') {
        targetPeople = await User.find({ _id: individualId, group: 'Tutor' }, 'name email group');
    } else if (reportType === 'individualStudent') {
        targetPeople = await User.find({ _id: individualId, group: 'Student' }, 'name email group');
    }

    const newReport = new Report({
        reportType: reportType,
        generatedBy: user.name,
        targetPeople: targetPeople,
        reportContent: reportContent
    });
    await newReport.save();

    res.render('report-generated', {
        reportType: reportType,
        user: user,
        reportContent: reportContent,
        targetPeople: targetPeople
    });
});


//STUDENT SECTION
app.get('/tutor-availability', jwtAuth, async (req, res) => {
    const user = req.auth;
    
    if (user.group === 'Student') {
        const availableTutors = await TutorAvailability.find();
        
        res.render('tutor-availability', {
            availableTutors: availableTutors
        });
    } else {
        res.status(403).send('Forbidden: Only Students can view tutor availability');
    }
});

app.post('/select-tutor', jwtAuth, async (req, res) => {
    const user = req.auth;
    
    if (user.group === 'Student') {
        const { tutorId, tutorName, date, time } = req.body;
        
        const newAssignment = new StudentTutorAssignment({
            tutorId: tutorId,
            tutorName: tutorName,
            studentId: user.email,
            studentName: user.name,
            date: date,
            time: time
        });
        await newAssignment.save();
        
        await TutorAvailability.findOneAndDelete({ tutorId: tutorId, date: date, time: time });
        
        res.render('tutor-selected', {
            tutorName: tutorName,
            date: date,
            time: time
        });
    } else {
        res.status(403).send('Forbidden: Only Students can select tutors');
    }
});


//TUTOR SECTION
app.get('/list-availability', jwtAuth, async (req, res) => {
    const user = req.auth;
    
    if (user.group === 'Tutor') {
        res.render('list-availability');
    } else {
        res.status(403).send('Forbidden: Only Tutors can list availability');
    }
});

app.post('/api/list-availability', async (req, res) => {
    const { date, time, recurrence, endDate } = req.body;
  
    try {
      const user = req.auth; 
      //const tutorProfile = await TutorProfile.findOne({ email: user.email });
      const userRecord = await User.findOne({ email: user.email, group: 'Tutor' });

    //   console.log("profile: ", tutorProfile)
    //   console.log("profile id: ", tutorProfile._id); 
    //   if (!tutorProfile) {
    //     return res.status(404).json({ message: 'Tutor profile not found.' });
    //     }
      const availabilityDate = new Date(`${date}T${time}`);
      const availabilityList = [];
  
      if (recurrence === 'none') {
        console.log('Current Availability Entry:', { date: availabilityDate, time: time });

        availabilityList.push({
          tutorId: userRecord._id,
          date: availabilityDate,
          time: time,
          recurrence: 'none'
        });
      } else {
        let currentDate = new Date(availabilityDate);
        const maxEndDate = endDate ? new Date(endDate) : null;
        while (!maxEndDate || currentDate <= maxEndDate) {
            console.log('Current Availability Entry:', { date: currentDate, time: time });

            availabilityList.push({
                tutorId: userRecord._id,
                date: new Date(currentDate),
                time: time,
                recurrence
            });
  
          switch (recurrence) {
            case 'daily':
              currentDate.setDate(currentDate.getDate() + 1);
              break;
            case 'weekly':
              currentDate.setDate(currentDate.getDate() + 7);
              break;
            case 'biweekly':
              currentDate.setDate(currentDate.getDate() + 14);
              break;
            case 'monthly':
              currentDate.setMonth(currentDate.getMonth() + 1);
              break;
          }
  
          if (availabilityList.length > 1000) break;
        }
      }
  
      await TutorAvailability.insertMany(availabilityList);
  
      res.redirect('/my-availability');
    } catch (error) {
      console.error('Error listing availability:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  
  
app.get('/my-availability', jwtAuth, async (req, res) => {
    const user = req.auth;
    console.log("clicked"); 
    if (user.group === 'Tutor') {
        const userRecord = await User.findOne({ email: user.email, group: 'Tutor' });
        //const tutorProfile = await TutorProfile.findOne({ userId: userRecord._id });
        console.log("userRecord: ", userRecord); 
        // if (!tutorProfile) {
        //         return res.status(404).send('Tutor profile not found.');
        // }
        const myAvailability = await TutorAvailability.find({ tutorId: userRecord._id });
        console.log("avail: ", myAvailability); 
        const availabilityEvents = myAvailability.map(a => ({
            title: `Available at ${a.time || 'Time Not Available'}`,
            start: new Date(a.date).toISOString(),
        }));
        console.log(availabilityEvents);

        res.render('my-availability', { availability: availabilityEvents });
    } else {
        res.status(403).send('Forbidden: Only Tutors can view their availability');
    }
});


app.get('/my-students', jwtAuth, async (req, res) => {
    const user = req.auth;

    if (user.group === 'Tutor') {
        const myStudents = await StudentTutorAssignment.find({ tutorId: user.email });

        res.render('my-students', { students: myStudents });
    } else {
        res.status(403).send('Forbidden: Only Tutors can view their students');
    }
});

app.get('/api/tutors/available', jwtAuth, async (req, res) => {
    const { lat, lon, subject } = req.query;
    console.log("in api/tutors/available"); 

    if (!lat || !lon || !subject) {
        return res.status(400).json({ message: 'Latitude and longitude are required.' });
    }

    try {
        const studentLat = parseFloat(lat);
        const studentLon = parseFloat(lon);

        if (isNaN(studentLat) || isNaN(studentLon)) {
            return res.status(400).json({ message: 'Invalid latitude or longitude.' });
        }

        const student = await User.findOne({ email: req.auth.email });
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }


        const studentProfile = await UserProfile.findOne({ userId: student._id });
        if (!studentProfile) {
            return res.status(404).json({ message: 'Student profile not found.' });
        }

        console.log("studentProfile: ", studentProfile); 

        const studentLearningStyles = (studentProfile.learningStyles || []).map(style =>
            style.toLowerCase().replace(/[\s-]/g, '')
        );
        console.log('Student Learning Styles:', studentLearningStyles);

        const tutors = await TutorProfile.find({}).select(
            'name email location learningStyles rating subjects isAvailable'
        ).lean(); 
        console.log('Tutors Retrieved:', tutors);

        const calculateDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371; 
            const dLat = ((lat2 - lat1) * Math.PI) / 180;
            const dLon = ((lon2 - lon1) * Math.PI) / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((lat1 * Math.PI) / 180) *
                    Math.cos((lat2 * Math.PI) / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c * 0.621371; // Convert to miles
        };

        // Map tutors with calculated distance
        const tutorsWithDistance = tutors.map(tutor => {
            if (!tutor.location || !tutor.location.lat || !tutor.location.lon) {
                console.warn(`Tutor ${tutor.email} has incomplete location data.`);
                return { ...tutor, distance: null };
            }
            const distance = calculateDistance(
                studentLat,
                studentLon,
                tutor.location?.lat,
                tutor.location?.lon
            );
            return { ...tutor, distance };
        });

        // Filter tutors within a 5-mile radius
        const filteredTutors = tutorsWithDistance.filter(tutor => {
            const matchesSubject = tutor.subjects.some(sub => sub.toLowerCase().includes(subject.toLowerCase()));
            return matchesSubject && tutor.distance <= 5; // Within 5 miles
        });

        console.lo

        // Match learning styles
        const filteredByLearningStyle = studentLearningStyles.length
            ? filteredTutors.filter(tutor => {
                  const normalizedTutorStyles = (tutor.learningStyles || []).map(style =>
                      style.toLowerCase().replace(/[\s-]/g, '')
                  );
                  const hasMatchingStyle = normalizedTutorStyles.some(style =>
                      studentLearningStyles.includes(style)
                  );
                  return hasMatchingStyle;
              })
            : filteredTutors;

        const sortedTutors = filteredByLearningStyle.sort((a, b) => {
            if (a.isAvailable === b.isAvailable) {
                return a.distance - b.distance; // Sort by distance if both have same availability
            }
            return b.isAvailable - a.isAvailable; // `isAvailable: true` first
        });

        res.json(sortedTutors);
    } catch (error) {
        console.error('Error fetching available tutors:', error);
        res.status(500).json({ message: 'Error fetching tutors.' });
    }
});






app.get('/find-tutors', jwtAuth, (req, res) => {
    const { subject } = req.query;

    if (!subject) {
        return res.status(400).send('Subject is required.');
    }

    try {
        res.render('find-tutors', { subject });
    } catch (error) {
        console.error('Error rendering find-tutors:', error);
        res.status(500).send('Internal server error.');
    }
    //res.render('find-tutors');
});

app.get('/api/tutor/:email/availability', async (req, res) => {
    const { email } = req.params;

    try {
        // Fetch the TutorProfile using the email
        const tutorProfile = await TutorProfile.findOne({ email });
        if (!tutorProfile) {
            return res.status(404).json({ message: 'Tutor profile not found.' });
        }

        // Query TutorAvailability using the tutor's ObjectId
        const tutorAvailability = await TutorAvailability.find({ tutorId: tutorProfile._id });

        // Fetch accepted requests to exclude from availability
        const acceptedRequests = await StudentTutorAssignment.find({
            tutorId: tutorProfile._id,
            status: 'accepted',
        });

        // Remove time slots that match accepted requests
        const updatedAvailability = tutorAvailability.filter(slot => {
            return !acceptedRequests.some(request =>
                request.date.toISOString() === slot.date.toISOString() && request.time === slot.time
            );
        });

        // Map the remaining availability into the required format
        const availabilityEvents = updatedAvailability.map(slot => ({
            title: `Available at ${slot.time || 'Time Not Available'}`,
            start: new Date(slot.date).toISOString(),
        }));

        // Return the tutor profile and filtered availability
        res.json({ tutor: tutorProfile, availability: availabilityEvents });
    } catch (error) {
        console.error('Error fetching tutor availability:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});



app.get('/tutor/:email/availability', async (req, res) => {
    const { email } = req.params;

    try {
        // Fetch the User with the provided email and ensure it's a Tutor
        const user = await User.findOne({ email, group: 'Tutor' });
        if (!user) {
            return res.status(404).send('Tutor not found.');
        }

        // Fetch the corresponding TutorProfile
        const tutor = await TutorProfile.findOne({ userId: user._id });
        if (!tutor) {
            return res.status(404).send('Tutor profile not found.');
        }

        // Fetch the availability using the TutorProfile's ObjectId
        const availability = await TutorAvailability.find({ tutorId: user._id });
        console.log("availability: ", availability); 
        // Map the availability to the required format for rendering
        const availabilityEvents = availability.map(a => ({
            title: `Available at ${a.time || 'Time Not Available'}`,
            start: new Date(a.date).toISOString(),
        }));

        console.log('Availability Events:', availabilityEvents);

        // Render the availability view
        res.render('student-tutor-availability', { tutor, availability: availabilityEvents });
    } catch (error) {
        console.error('Error fetching tutor availability:', error);
        res.status(500).send('Internal server error.');
    }
});


app.post('/api/request-time-slot', async (req, res) => {
    const { tutorEmail, date, time, reason } = req.body;

    if (!tutorEmail || !date || !time || !reason) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const tutorUser = await User.findOne({ email: tutorEmail, group: 'Tutor' });
        if (!tutorUser) {
            return res.status(404).json({ message: 'Tutor not found.' });
        }
        const studentUser = await User.findOne({ email: req.auth.email, group: 'Student' });
        console.log("studentUser Name: ", studentUser.name); 
        //console.log("studentUser: ", studentUser); 
        // Create a new request and save it
        const request = new StudentTutorAssignment({
            tutorId: tutorUser._id,
            studentId: studentUser._id,
            studentName: studentUser.name,
            date,
            time,
            reason,
            status: 'pending',
        });

        await request.save();
        res.status(201).json({ message: 'Request submitted successfully.' });
    } catch (error) {
        console.error('Error handling request:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


app.get('/api/tutor/requests', jwtAuth, async (req, res) => {
    try {
        const tutorEmail = req.auth.email;
        const tutor = await User.findOne({ email: tutorEmail, group: 'Tutor' });
        if (!tutor) {
            return res.status(404).json({ message: 'Tutor not found.' });
        }

        //console.log("Fetching requests for tutor:", tutor._id);

        const requests = await StudentTutorAssignment.find({ tutorId: tutor._id });
        //console.log("Fetched requests:", requests);

        res.json(requests);
    } catch (error) {
        console.error('Error fetching tutor requests:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


app.post('/api/tutor/requests/respond', jwtAuth, async (req, res) => {
    const { requestId, action } = req.body; // `action` can be "accept" or "decline"

    try {
        const request = await StudentTutorAssignment.findById(requestId);
        console.log("request: ", request); 

        if (!request) {
            return res.status(404).json({ message: 'Request not found.' });
        }

        if (action === 'accept') {
            // console.log("accepted!");
            // console.log("tutorId:", request.tutorId);
            // console.log("date:", request.date);
            // console.log("time:", request.time);

            const tutor = await TutorProfile.findOne({ userId: request.tutorId });
            console.log("tutor: ", tutor); 

            const stuRequest = await StudentTutorAssignment.findById(requestId);
            const studentProfile = await UserProfile.findOne({ userId: stuRequest.studentId });
            console.log("studentUser: ", studentProfile); 

           

            const tutorIdAsObjectId = new mongoose.Types.ObjectId(request.tutorId);

            const output = await TutorAvailability.find({ tutorId: tutorIdAsObjectId }); 
            
           
            const formatTime = (time) => {
                return time.split(':').slice(0, 2).join(':');
            };
           
            const result = await TutorAvailability.deleteOne({
                tutorId: tutorIdAsObjectId,
                date: request.date,
                time: formatTime(request.time),
            });
            
            console.log(`Delete result:`, result);

            if (!Array.isArray(studentProfile.upcomingLessons)) {
                studentProfile.upcomingLessons = [];
            }

            const lesson = {
                tutor: tutor.email,
                date: new Date(request.date).toISOString(),
            };
            studentProfile.upcomingLessons.push(lesson);
            await studentProfile.save();
            console.log("Updated student profile:", studentProfile);


            //console.log(`Deleted availability for ${request.tutorId} on ${request.date} at ${request.time}`);

            request.status = 'accepted';
        } else if (action === 'decline') {
            request.status = 'declined';
        }

        await request.save();
        res.json({ message: `Request ${action}ed successfully.` });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/tutor/toggle-availability', jwtAuth, async (req, res) => {
    const { onDemand } = req.body; // No location should be handled here

    try {
        const tutorEmail = req.auth.email;
        const user = await User.findOne({ email: tutorEmail, group: 'Tutor' });
        const tutorProfile = await TutorProfile.findOne({ userId: user._id });

        if (!tutorProfile) {
            return res.status(404).json({ message: 'Tutor profile not found.' });
        }

        // Toggle availability
        tutorProfile.onDemand = onDemand;
        tutorProfile.isAvailable = onDemand; // Availability depends on onDemand toggle

        await tutorProfile.save();
        console.log("Saved Tutor Profile (toggle-availability):", tutorProfile);

        res.status(200).json({ message: 'Availability updated successfully.', profile: tutorProfile });
    } catch (error) {
        console.error('Error updating availability:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});




app.post('/api/tutor/location', jwtAuth, async (req, res) => {
    const { lat, lon } = req.body;

    if (!lat || !lon) {
        return res.status(400).json({ message: 'Latitude and longitude are required.' });
    }

    try {
        const tutorEmail = req.auth.email;
        const user = await User.findOne({ email: tutorEmail, group: 'Tutor' });
        const tutorProfile = await TutorProfile.findOne({ userId: user._id });

        if (!tutorProfile) {
            return res.status(404).json({ message: 'Tutor profile not found.' });
        }

        tutorProfile.location = { lat, lon, lastUpdated: new Date() };
        tutorProfile.isAvailable = true;

        await tutorProfile.save();
        const updatedProfile = await TutorProfile.findOne({ userId: user._id });
        console.log('Updated Location for Tutor:', updatedProfile);

        res.status(200).json({ message: 'Location updated successfully.', location: updatedProfile.location });
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


app.post('/api/tutor/disable-location', jwtAuth, async (req, res) => {
    try {
        const tutorEmail = req.auth.email;
        const tutorProfile = await User.findOne({ email: tutorEmail, group: 'Tutor' });

        if (!tutorProfile) {
            return res.status(404).json({ message: 'Tutor profile not found.' });
        }

        tutorProfile.location = null;
        tutorProfile.isAvailable = false;

        await tutorProfile.save();

        console.log('Disabled location for tutor:', tutorProfile);
        res.status(200).json({ message: 'Location disabled successfully.' });
    } catch (error) {
        console.error('Error disabling location:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

//upload pic route
app.post('/upload-profile-picture-student', jwtAuth, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        const user = await User.findOne({ email: req.auth.email });
        const studentProfile = await UserProfile.findOne({ userId: user._id });


        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        studentProfile.profilePicture = `/uploads/${req.file.filename}`;
        console.log("user profile pic: ", user); 
        await studentProfile.save();

        res.redirect('/profile'); 
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.post('/upload-profile-picture-tutor', jwtAuth, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        const user = await User.findOne({ email: req.auth.email, group: 'Tutor'  });
        const tutorProfile = await TutorProfile.findOne({ userId: user._id });


        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        tutorProfile.profilePicture = `/uploads/${req.file.filename}`;
        console.log("tutor profile pic: ", tutorProfile); 
        await tutorProfile.save();

        res.redirect('/profile'); 
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



app.get('/logout', (req, res) => {
    res.clearCookie('jwt');
    const logoutUrl = `${auth0Issuer}/v2/logout?client_id=${clientId}&returnTo=http://localhost:3000`;
    res.redirect(logoutUrl);
});


app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'sha256-abCdEfGhIjKlMnOpQrStUvWxYz1234567890+AbCdEfGhI=' https://cdnjs.cloudflare.com"
    );
    next();
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
