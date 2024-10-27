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
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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
    auth_id: String
});
const User = mongoose.model('User', userSchema);

const tutorAvailabilitySchema = new mongoose.Schema({
    tutorId: String,
    tutorName: String,
    date: String,
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
}).unless({ path: ['/login', '/callback', '/signup', '/', '/group-selection', '/set-group'] });

app.use(jwtAuth);

// Routes
app.get('/', (req, res) => {
    res.send('<h1>Welcome To Tutrix</h1><a href="/login">Login</a> <a href="/signup">Sign Up</a>');
});

app.get('/login', (req, res) => {
    const authUrl = `${auth0Issuer}/authorize?response_type=code&client_id=${clientId}&redirect_uri=http://localhost:3000/callback&scope=openid profile email`;
    res.redirect(authUrl);
});

app.get('/signup', (req, res) => {
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
        const existingUser = await User.findOne({ email: userInfo.email });

        if (!existingUser) {
            res.cookie('tempUser', JSON.stringify(userInfo), { httpOnly: true });
            return res.redirect('/group-selection');
        } else {
            const token = jwt.sign({ name: existingUser.name, email: existingUser.email, group: existingUser.group }, jwtSecret, { expiresIn: '1h' });
            res.cookie('jwt', token, { httpOnly: true });
            return res.redirect('/profile');
        }
    } catch (error) {
        console.error('Error exchanging code for tokens:', error);
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

app.post('/set-group', async (req, res) => {
    const tempUser = req.cookies.tempUser ? JSON.parse(req.cookies.tempUser) : null;

    if (!tempUser) {
        return res.redirect('/login'); 
    }

    const { firstName, lastName, group } = req.body;
    const fullName = `${firstName} ${lastName}`;

    try {
        let user = await User.findOne({ email: tempUser.email });
        if (!user) {
            user = new User({
                name: fullName,
                email: tempUser.email,
                group: group,
                auth_provider: 'Auth0',
                auth_id: tempUser.sub,
            });
            await user.save();
        }

        const token = jwt.sign({ name: user.name, email: user.email, group: user.group }, jwtSecret, { expiresIn: '1h' });
        res.cookie('jwt', token, { httpOnly: true });
        res.clearCookie('tempUser');
        return res.redirect('/profile');
    } catch (error) {
        console.error('Error in /set-group:', error);
        return res.status(500).send('Internal server error');
    }
});

app.get('/profile', jwtAuth, async (req, res) => {
    const { email } = req.auth; 

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.redirect('/login');
        }
        res.render('profile', { user });
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

app.post('/list-availability', jwtAuth, async (req, res) => {
    const user = req.auth;

    if (user.group === 'Tutor') {
        const { date, time } = req.body;

        const newAvailability = new TutorAvailability({
            tutorId: user.email,
            tutorName: user.name,
            date: date,
            time: time
        });

        await newAvailability.save();

        res.render('availability-confirmation');
    } else {
        res.status(403).send('Forbidden: Only Tutors can list availability');
    }
});


app.get('/my-availability', jwtAuth, async (req, res) => {
    const user = req.auth;

    if (user.group === 'Tutor') {
        const myAvailability = await TutorAvailability.find({ tutorId: user.email });

        res.render('my-availability', { availability: myAvailability });
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




app.get('/logout', (req, res) => {
    res.clearCookie('jwt');
    const logoutUrl = `${auth0Issuer}/v2/logout?client_id=${clientId}&returnTo=http://localhost:3000`;
    res.redirect(logoutUrl);
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
