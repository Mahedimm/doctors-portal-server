const express = require('express');
const fileUpload = require('express-fileupload');

const app = express();
require('dotenv').config();
const cors = require('cors');
const admin = require('firebase-admin');
// Middleware
app.use(cors());
app.use(fileUpload());
app.use(express.json());
const port = process.env.PORT || 5000;

const { MongoClient } = require('mongodb');

// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const serviceAccount = require('./doctors-portal-adminsdk.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j06rk.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyIdToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const idToken = req.headers.authorization.split(' ')[1];

        try {
            const decodedIdToken = await admin.auth().verifyIdToken(idToken);
            req.decodedIdToken = decodedIdToken.email;
        } catch {}
    }
    next();
}

async function run() {
    try {
        await client.connect();
        // console.log('Connected to MongoDB');
        const db = client.db('doctorsPortal');
        const appointmentsCollection = db.collection('appointments');
        const doctorCollection = db.collection('doctors');
        const userCollection = db.collection('users');

        app.get('/appointments', async (req, res) => {
            const { patientEmail } = req.query;
            const { date } = req.query;
            // console.log(date);
            const query = { patientEmail, date };
            // console.log(query);
            const UserAppointments = await appointmentsCollection.find(query).toArray();
            res.json(UserAppointments);
        });

        app.get('/allAppointments', async (req, res) => {
            const { date } = req.query;
            const query = { date };
            const appointments = await appointmentsCollection.find(query).toArray();
            res.json(appointments);
        });
        app.get('/doctors', async (req, res) => {
            const doctors = await doctorCollection.find({}).toArray();
            res.json(doctors);
        });

        app.get('/users/:email', async (req, res) => {
            const { email } = req.params;
            const query = { email };
            const user = await userCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });
        app.post('/addDoctor', async (req, res) => {
            const { doctorName } = req.body;
            const { doctorEmail } = req.body;
            const doctorImg = req.files.image;
            const imgData = doctorImg.data;
            const encodeImg = imgData.toString('base64');
            const imageBuffer = Buffer.from(encodeImg, 'base64');
            const doctor = {
                doctorName,
                doctorEmail,
                image: imageBuffer,
            };
            const result = await doctorCollection.insertOne(doctor);
            console.log(result);
            res.json(result);
        });

        app.put('/users', async (req, res) => {
            const user = req.body;
            // console.log('put', user);
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });

        app.put('/users/admin', verifyIdToken, async (req, res) => {
            const user = req.body;
            const requestorEmail = req.decodedIdToken;
            if (requestorEmail) {
                const filterAdmin = { email: requestorEmail };
                const requestAccount = await userCollection.findOne(filterAdmin);
                if (requestAccount?.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await userCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            } else {
                res.status(401).send('Unauthorized');
            }
        });

        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            // console.log(appointment);
            const result = await appointmentsCollection.insertOne(appointment);
            res.json(result);
        });
    } catch (e) {
        console.error(e);
    } finally {
        // await client.close();
    }
}

run().catch(console.dir);
app.get('/', (req, res) => {
    res.send('Hello Doctors Portal!');
});

app.listen(port, () => {
    console.log(` listening at ${port}`);
});
