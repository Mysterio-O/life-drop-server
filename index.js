require('dotenv').config();
const cors = require('cors');
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
const app = express()
const port = 3000;

app.use(express.json());
app.use(cors({
    origin: ['https://life-drop-bd.netlify.app', 'http://localhost:5173'],
    credentials: true
}));

const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_SECRET);



const serviceAccount = require("./lifedrop-firebase-adminsdk.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



const client = new MongoClient(process.env.MONGO_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


const db = client.db('lifeDropDB');

const userCollection = db.collection('users');
const requestCollection = db.collection('requests');
const blogCollection = db.collection('blogs');
const fundingCollection = db.collection("funding");
const messageCollection = db.collection('messages');
const subscriberCollection = db.collection('subscribers');
const applicationCollection = db.collection('applications');

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // middlewares

        const verifyFBToken = async (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'unauthorized access' })
            }

            const token = authHeader.split(' ')[1];
            if (!token) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            try {
                const decoded = await admin.auth().verifyIdToken(token);
                req.decoded = decoded;
                next();
            }
            catch (error) {
                res.status(500).send({ message: 'internal server error' });
            }

        };

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const result = await userCollection.findOne({ email });
            // console.log('role from admin verify middleware', result);
            if (!result || result.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        };

        const verifyShared = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await userCollection.findOne({ email });
            if (user.role === 'admin' || user.role === 'volunteer' && user) {
                next();
            } else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        }


        // users api
        app.post('/users', async (req, res) => {
            try {
                const userInfo = req.body;
                if (!userInfo) {
                    return res.status(400).send({ message: 'user info not found' });
                } else {
                    userInfo.role = "donor",
                        userInfo.status = "active"
                }

                const userEmail = userInfo.email;
                const existingUser = await userCollection.findOne({ email: userEmail });
                if (existingUser) {
                    return res.status(400).send({ message: 'already user with this email exists!' })
                }

                const newUser = await userCollection.insertOne(userInfo);
                res.status(201).send(newUser);
            }
            catch (error) {
                res.status(500).send({ message: 'error inserting new user!', error });
            }

        });

        app.get('/user', verifyFBToken, async (req, res) => {
            try {
                const { email } = req.query;
                // console.log('email is->', email);
                let filter = {};
                if (!email) {
                    return res.status(400).send({ message: 'email not found!' });
                } else {
                    filter = { email };
                }
                // console.log('filter is->', filter);
                const user = await userCollection.findOne(filter);
                if (!user) {
                    return res.status(404).send({ message: "User didn't found!" });
                }
                res.status(200).send(user);
            }
            catch (error) {
                console.error('error getting user', error);
                res.status(500).send({ message: "error getting user", error });
            }
        });

        // all users count
        app.get('/all-users-count', verifyFBToken, verifyShared, async (req, res) => {
            try {
                const count = await userCollection.estimatedDocumentCount();
                res.status(200).send(count);
            }
            catch (error) {
                console.error("error getting all users count", error);
                res.status(500).send({ message: "error getting all users count", error });
            }
        });

        app.get('/all-users', verifyFBToken, verifyAdmin, async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const status = req.query.status;
                const email = req.query.email;

                const query = status && status !== 'all' ? { status } : {};

                const totalUsers = await userCollection.countDocuments(query);
                const totalPages = Math.ceil(totalUsers / limit);

                const users = await userCollection.find(query)
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .toArray();
                if (!users) {
                    return res.status(404).send({ message: "users not found!" });
                }

                const usersList = users.filter(u => u?.email !== email)

                res.status(200).send({ message: "users found!", users: usersList, totalPages });
            }
            catch (error) {
                console.error("error getting all users", error);
                res.status(500).send({ message: "error getting all users", error });
            }
        })


        // get user profile picture
        app.get('/user/profile-picture/:email', async (req, res) => {
            const { email } = req.params;
            // console.log(email);
            let userInfo = {}
            if (!email) {
                return res.status(400).send({ message: 'blog authors email not found' });
            }
            try {
                const user = await userCollection.findOne({ email });
                if (!user) {
                    return res.status(404).send({ message: "no user found" });
                }
                const photo = user?.photoURL;
                const name = user?.name;
                if (!photo) {
                    const defaultAvatar = 'https://i.ibb.co/bRgZG4Dk/user-profile-icon-vector-avatar-600nw-2247726673.webp'
                    userInfo.photoURL = defaultAvatar;
                    userInfo.name = name
                    return res.status(200).send({ message: 'user  photo not found', userInfo });
                } else {
                    userInfo.photoURL = photo;
                    userInfo.name = name;
                    res.status(200).send({ message: "photoURL found", userInfo });
                }
            }
            catch (error) {
                console.error("error getting user photoURL", error);
                res.status(500).send({ message: "error getting user photoURL", error });
            }
        })


        // get user role

        app.get('/user/:email/role', verifyFBToken, async (req, res) => {
            const { email } = req.params;
            if (!email) {
                return res.status(400).send({ message: 'email not found' });
            }
            try {
                const user = await userCollection.findOne({ email });
                if (!user) {
                    return res.status(404).send({ message: 'user not found' });
                }
                res.status(200).send({ message: 'user role found', role: user.role });
            }
            catch (error) {
                console.error('error getting user role', error);
                res.status(500).send({ message: "server error getting user role", error });
            }
        });

        app.get('/user/:email/status', verifyFBToken, async (req, res) => {
            const { email } = req.params;
            if (!email) {
                return res.status(400).send({ message: 'email not found' });
            }
            try {
                const user = await userCollection.findOne({ email });
                if (!user) {
                    return res.status(404).send({ message: 'user not found' });
                }
                res.status(200).send({ message: 'user status found', status: user.status });
            }
            catch (error) {
                console.error('error getting user status', error);
                res.status(500).send({ message: "server error getting user status", error });
            }
        })

        // PATCH /user/update/:id (user profile update)
        app.patch('/user/update/:id', verifyFBToken, async (req, res) => {
            const userId = req.params.id;
            const updateFields = req.body;

            // Validate only allowed fields
            const allowedFields = ['name', 'division', 'district', 'upazila', 'blood_group', 'photoURL', 'name', "number", "address"];
            const updateData = {};

            for (const key of allowedFields) {
                if (key in updateFields) {
                    updateData[key] = updateFields[key];
                }
            }

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ message: 'No valid fields to update.' });
            }

            try {
                updateData.last_update = new Date().toISOString();
                const result = await userCollection.updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: updateData }
                );

                if (result.modifiedCount > 0) {
                    return res.json({ message: 'User updated successfully.', result });
                } else {
                    return res.status(404).json({ message: 'User not found or data unchanged.' });
                }
            } catch (err) {
                console.error('Error updating user:', err);
                res.status(500).json({ message: 'Internal server error.' });
            }
        });


        // PATCH user status update (admin only)
        app.patch('/user/:id/status', verifyFBToken, verifyAdmin, async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            console.log(status, id);
            try {
                const filter = { _id: new ObjectId(id) };
                const result = await userCollection.updateOne(
                    filter,
                    {
                        $set: { status }
                    }
                );
                res.status(201).send({ message: "status updated", result });
            }
            catch (error) {
                console.error("error updating user status", error);
                res.status(500).send({ message: "error updating user status", error });
            }
        });


        // PATCH user role update (admin only)
        app.patch('/user/:id/role', verifyFBToken, verifyAdmin, async (req, res) => {
            const { id } = req.params;
            const { role } = req.body;
            console.log(id, role);
            if (!id) {
                return res.status(400).send({ message: "user id not found" });
            }
            if (!role) {
                return res.status(400).send({ message: "updated role value not found" });
            }
            try {
                const result = await userCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            role
                        }
                    }
                );
                if (result.modifiedCount < 1) {
                    return res.status(404).send({ message: 'user role not updated', result });
                }
                res.status(201).send({ message: "user role updated", result });
            }
            catch (error) {
                console.error("error updating user role", error);
                res.status(500).send({ message: "error updating user role", error })
            }
        });


        // delete user from database
        app.delete("/user-delete/:email", verifyFBToken, async (req, res) => {
            const { email } = req.params;
            if (!email) {
                return res.status(400).send({ message: "user email not found" });
            }
            try {
                const result = await userCollection.deleteOne({ email });
                if (result.deletedCount < 1) {
                    return res.status(400).send("user delete failed");
                }
                res.status(200).send({ message: 'user deleted successfully', result })
            }
            catch (error) {
                console.error("error deleting user", error);
                res.status(500).send({ message: "error deleting user", error });
            }
        })



        // donation request apis
        app.post('/create-request', verifyFBToken, async (req, res) => {
            const requestInfo = req.body;
            if (!requestInfo) {
                return res.status(400).send({ message: 'no request information found!' });
            }

            try {
                const result = await requestCollection.insertOne(requestInfo);
                res.status(201).send({ message: 'request added successfully', result });
            }
            catch (error) {
                console.error('error adding new request', error);
                res.status(500).send({ message: 'error adding new request', error });
            }

        });

        app.get('/requests', verifyFBToken, async (req, res) => {
            const { email, limit, order } = req.query;

            if (!email) {
                return res.status(400).send({ message: 'user email not found!' });
            }

            const filter = { requesterEmail: email };
            const sortOrder = order === 'asc' ? 1 : -1; // default to descending

            try {
                if (limit) {
                    const result = await requestCollection
                        .find(filter)
                        .sort({ createdAt: sortOrder })
                        .limit(Number(limit))
                        .toArray();
                    return res.status(200).send({ message: 'found top requests', result });
                }

                const users = await requestCollection
                    .find(filter)
                    .sort({ createdAt: sortOrder })
                    .toArray();

                if (!users || users.length === 0) {
                    return res.status(404).send({ message: 'no request found with this email' });
                }

                res.status(200).send({ message: 'requests found', users });
            } catch (error) {
                console.error('error getting donation requests', error);
                res.status(500).send({ message: "error getting donation requests", error });
            }
        });


        // donation requests count
        app.get('/all-donation-request', verifyFBToken, verifyShared, async (req, res) => {
            try {
                const count = await requestCollection.estimatedDocumentCount();
                console.log(count); // 20 on the console
                res.status(200).send(count);
            }
            catch (error) {
                console.error('error getting all donation request count', error);
                res.status(500).send({ message: 'error getting all donation request count', error });
            }
        });

        app.delete('/donation-requests/:id', verifyFBToken, async (req, res) => {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send({ message: 'request id not found!' });
            }

            try {
                const result = await requestCollection.deleteOne({ _id: new ObjectId(id) });
                if (!result) {
                    return res.status(400).send({ message: 'failed to delete request' });
                }
                res.status(200).send({ message: 'deleted successfully', result });
            }
            catch (error) {
                console.error('error deleting donation request', error);
                res.status(500).send({ message: "internal server error deleting donation request", error });
            }


        });

        // GET /donation-requests 
        app.get("/donation-requests", verifyFBToken, async (req, res) => {
            try {
                const email = req.query.email;
                const status = req.query.status;
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;

                if (!email) {
                    return res.status(400).send({ message: "Email is required" });
                }

                const filter = { requesterEmail: email };
                if (status && status !== "all") {
                    filter.status = status;
                }

                const totalCount = await requestCollection.countDocuments(filter);
                const totalPages = Math.ceil(totalCount / limit);

                const requests = await requestCollection
                    .find(filter)
                    .sort({ createdAt: -1 }) // optional: latest first
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .toArray();

                res.send({ requests, totalPages });
            } catch (error) {
                console.error("Error fetching donation requests:", error.message);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        app.get("/donation-requests/pending", async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const skip = (page - 1) * limit;

                const filter = {
                    status: { $in: ['pending', 'emergency'] }
                };

                const total = await requestCollection.countDocuments(filter);
                const result = await requestCollection
                    .find(filter)
                    .sort({
                        donationDate: 1,
                        donationTime: 1
                    })
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                if (!result || result.length === 0) {
                    return res.status(404).send({ message: 'no pending donation request found', total: 0, result: [] });
                }

                res.status(200).send({ message: 'requests found', total, result });
            } catch (error) {
                console.error('error getting pending donation request data', error);
                res.status(500).send({ message: "error getting pending donation request data" });
            }
        });

        app.get('/donation-requests/emergency', async (req, res) => {
            try {
                const page = parseInt(req.query.page);
                const limit = parseInt(req.query.limit);
                const skip = (page - 1) * limit;
                const filter = { status: 'emergency' };
                const total = await requestCollection.countDocuments(filter);
                const requests = await requestCollection.find(filter)
                    .sort({
                        donationDate: 1,
                        donationTime: 1
                    })
                    .skip(skip)
                    .limit(limit)
                    .toArray();
                if (requests.length < 1) {
                    return res.status(404).json({ message: 'no emergency donation request found', total: 0, result: [] });
                }
                res.status(200).json({ message: 'requests found', total, requests });
            }
            catch (err) {
                console.error("error getting emergency donation requests", err);
                res.status(500).json({ message: "error getting emergency donation requests" })
            }
        })

        app.get('/donation-request/:id', async (req, res) => {
            const { id } = req.params;
            console.log(typeof id, id)
            if (!id) {
                return res.status(400).send({ message: "request id not found!" })
            }

            try {
                const request = await requestCollection.findOne({ _id: new ObjectId(id) });
                if (!request) {
                    return res.status(404).send({ message: "no donation request found with this id->", id });
                }
                res.status(200).json(request);
            }
            catch (error) {
                console.error("error getting donation request", error);
                res.status(500).send({ message: "error getting donation request", error });
            }

        })

        app.patch('/donation-requests/:id', verifyFBToken, async (req, res) => {
            const { id } = req.params;
            const { status, donorMobile, donorEmail, donorName } = req.body;

            console.log(status);

            if (!id) {
                return res.status(400).send({ message: "donation request id not found" });
            }
            if (!status) {
                return res.status(400).send({ message: "status not found" });
            }
            let filter = {};

            if (status === 'emergency') {
                filter = {
                    $set: {
                        status: status,
                    }
                }
            }

            if (status === 'done') {
                filter = {
                    $set: {
                        status: status,
                        donated_by: donorEmail,
                        donated_at: new Date().toISOString()
                    }
                }
            }

            if (status === 'canceled') {
                filter = {
                    $set: {
                        status: status,
                        canceled_at: new Date().toISOString(),
                        donor_email: null,
                        donor_name: null,
                        donor_number: null
                    }
                }
            }

            if (status === 'in_progress') {
                filter = {
                    $set: {
                        status: status,
                        donor_number: donorMobile,
                        donor_email: donorEmail,
                        donor_name: donorName
                    }
                }
            } else if (status === 'in_progress' && !donorMobile) {
                filter = {
                    $set: {
                        status: status,
                        donor_email: donorEmail,
                        donor_name: donorName
                    }
                }
            }


            try {
                const result = await requestCollection.updateOne(
                    { _id: new ObjectId(id) },
                    filter
                );
                if (!result) {
                    return res.status(404).send({ message: 'request not found!' });
                }
                res.status(201).send({ message: 'status updated', result });
            }
            catch (error) {
                console.error("error updating donation request status", error);
                res.status(500).send({ message: "error updating donation request status" });
            }

        });

        app.patch('/donation-request/:id', verifyFBToken, async (req, res) => {
            const { id } = req.params;
            const updateData = req.body;
            if (!id || !updateData) {
                return res.status(400).send({ message: 'request id or updated data missing' });
            }
            try {
                const request = await requestCollection.findOne({ _id: new ObjectId(id) });
                if (!request) {
                    return res.status(404).send({ message: "donation request not found" });
                }

                const allowedUpdates = ['recipientName', 'recipientNumber', 'division', 'district', 'upazila', 'hospitalName', 'address', 'bloodGroup', 'donationDate', 'donationTime', 'requestMessage'];

                const updates = {};
                allowedUpdates.forEach(field => {
                    if (updateData[field] !== undefined) {
                        updates[field] = updateData[field];
                    }
                });

                updates.updatedAt = new Date().toISOString();
                updates.status = 'pending';

                const result = await requestCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: updates
                    }
                );
                if (result.modifiedCount < 1) {
                    return res.status(400).send({ message: 'update failed' });
                }
                res.status(201).send(result);

            }
            catch (error) {
                console.error('error patching donation requests', error);
                res.status(500).send({ message: 'error patching donation requests', error });
            }
        })






        // shared controlled apis





        app.get('/all-blood-donation-request', verifyFBToken, verifyShared, async (req, res) => {
            try {
                // console.log("entered");
                const status = req.query.status;
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                // console.log(status);
                let filter = {};

                if (status && status !== 'all') {
                    filter.status = status;
                }
                // console.log(filter)
                const totalCount = await requestCollection.countDocuments(filter);

                const totalPages = Math.ceil(totalCount / limit);
                const requests = await requestCollection
                    .find(filter)
                    .sort({ donationDate: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .toArray();
                if (!requests) {
                    return res.status(404).send({ message: "no requst found with this filter" });
                }
                res.status(200).send({ message: 'requests found', requests, totalPages });

            }
            catch (error) {
                console.error("Error fetching all donation requests:", error.message);
                res.status(500).send({ message: "Internal Server Error in fetching all donation requests" });
            }
        });


        app.get('/donation-status-distribution', verifyFBToken, verifyShared, async (req, res) => {
            try {
                const statusDistribution = await requestCollection.aggregate([
                    {
                        $match: {
                            status: { $in: ['done', 'in_progress', 'canceled'] } // Filter relevant statuses
                        }
                    },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            name: '$_id',
                            value: '$count'
                        }
                    }
                ]).toArray();

                // console.log(statusDistribution);

                if (!statusDistribution) {
                    return res.status(404).send({ message: "nof found request status" });
                }

                res.status(200).json(statusDistribution);

            } catch (error) {
                console.error('Error fetching donation status distribution:', error);
                res.status(500).send({ message: 'Internal server error', error: error.message });
            }
        });


        app.get('/user-status-distribution', verifyFBToken, verifyShared, async (req, res) => {
            try {
                const statusDistribution = await userCollection.aggregate([
                    {
                        $match: {
                            status: { $in: ['active', 'blocked'] }
                        }
                    },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            status: '$_id',
                            value: '$count'
                        }
                    }
                ]).toArray();
                console.log(statusDistribution);

                if (!statusDistribution) {
                    return res.status(404).send({ message: 'user status distribution not found' });
                }

                res.status(200).json(statusDistribution);

            }
            catch (error) {
                console.error("error getting user count on status", error);
                res.status(500).send({ message: "error getting user count on status", error });
            }
        })


        // blog apis (admin + shared)
        app.post('/create-blog', verifyFBToken, verifyShared, async (req, res) => {
            const blog = req.body || {};
            const blogData = { ...blog };
            console.log('top of first condition', blogData);
            if (!blogData) {
                return res.status(400).send({ message: "blog info not found" });
            } else {
                blogData.status = "draft";
                blogData.created_at = new Date().toISOString();
                blogData.comments = [];
            }

            console.log(blogData);
            try {
                const result = await blogCollection.insertOne(blogData);
                console.log(result)
                if (result.insertedId) {
                    return res.status(201).send({ message: "blog added to database", result });
                }
            }
            catch (error) {
                console.error("error adding new blog", error);
                res.status(500).send({ message: "internal server error adding new blog", error });
            }
        });

        app.get('/all-blogs', verifyFBToken, verifyShared, async (req, res) => {
            const { status, page = 1, limit = 10 } = req.query;
            const query = {};
            if (status && ['draft', 'published'].includes(status)) {
                query.status = status;
            }
            try {
                const blogs = await blogCollection.find(query)
                    .skip((page - 1) * limit)
                    .limit(parseInt(limit))
                    .sort({ created_at: -1 })
                    .toArray();
                if (!blogs) {
                    return res.status(404).send({ message: "blogs not found" });
                }
                res.status(200).send({ message: "blogs found", blogs });
            }
            catch (error) {
                console.error('error getting blogs data', error);
                rs.status(500).send({ message: "error getting blogs data", error });
            }
        });

        // single blog get api

        app.get('/blog', verifyFBToken, verifyShared, async (req, res) => {
            const { id } = req.query;
            if (!id) {
                return res.status(400).send({ message: "blog id not found!" });
            }
            try {
                const blog = await blogCollection.findOne({ _id: new ObjectId(id) });
                if (!blog) {
                    return res.status(404).send({ message: 'no blog found with this id' });
                }
                res.status(200).send({ message: 'blog found!', blog });
            }
            catch (error) {
                console.error("error getting single blog data", error);
                res.status(500).send({ message: "error getting single blog data", error });
            }
        })

        // blog update (draft / published)
        app.patch("/blogs/:id/status", verifyFBToken, verifyAdmin, async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            if (!status) {
                return res.status(400).send({ message: "new status not found!" });
            }
            if (!id) {
                return res.status(400).send({ message: "blog id not found!" });
            }
            try {
                const result = await blogCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status: status
                        }
                    }
                );
                if (result.modifiedCount < 1) {
                    return res.status(404).send({ message: "no changes found in the blog collection" });
                }
                res.status(201).send({ message: 'updated blog status', result });
            }
            catch (error) {
                console.error("error updating blog status", error);
                res.status(500).send({ message: "error updating blog status", error });
            }
        });

        // update blog (blog body)
        app.patch('/blog/:id', verifyFBToken, verifyShared, async (req, res) => {
            const { id } = req.params;
            const blog = req.body || {};
            const blogData = { ...blog };
            if (!id) {
                return res.status(400).send({ message: 'blog id not found' });
            }
            if (!blog || !blogData) {
                return res.status(400).send({ message: 'blog data not found' });
            } else {
                blogData.updated_at = new Date().toISOString();
            }
            try {
                const result = await blogCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: { ...blogData }
                    }
                );
                console.log('result from blog update->', result);
                if (!result || result.modifiedCount < 1) {
                    return res.status(404).send({ message: 'update incomplete' });
                }
                res.status(200).send({ message: "blog updated", result })
            }
            catch (error) {
                console.error("error updating blog data", error);
                res.status(500).send({ message: "error updating blog data", error })
            }


        });

        app.delete('/blogs/:id', verifyFBToken, verifyAdmin, async (req, res) => {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send({ message: 'blog id not found' });
            }
            try {
                const result = await blogCollection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount < 1) {
                    return res.status(404).send({ message: 'blog not deleted' });
                }
                res.status(204).send({ message: "blog deleted" });
            }
            catch (error) {
                console.error("error deleting blog", error);
                res.status(500).send({ message: "error deleting blog", error });
            }
        });

        // blog -- public

        app.get('/all-blogs-public', async (req, res) => {
            try {
                const blogs = await blogCollection.find(
                    { status: 'published' }
                ).toArray();
                if (!blogs) {
                    return res.status(404).send({ message: "No blogs avaiable now." });
                } else {
                    res.status(200).send({ message: "blogs found", blogs });
                }
            }
            catch (error) {
                console.error("error getting all blogs (public)", error);
                res.status(500).send({ message: "error getting all blogs (public)", error });
            }
        });



        app.patch('/like-blog', verifyFBToken, async (req, res) => {
            const { blogId, email } = req.body;
            // console.log(body);
            if (!blogId || !email) {
                return res.status(400).send({ message: 'missing body' });
            };
            const blog = await blogCollection.findOne({ _id: new ObjectId(blogId) });
            const isLiked = blog.liked_by.includes(email);
            let result;
            try {
                const blog = await blogCollection.findOne({ _id: new ObjectId(blogId) });
                const isLiked = blog.liked_by.includes(email);
                let result;
                let response;
                if (!isLiked) {
                    result = await blogCollection.updateOne(
                        { _id: new ObjectId(blogId), status: 'published' },
                        {
                            $addToSet: {
                                liked_by: email
                            }
                        }
                    );
                    response = ({ action: "liked", result });
                } else {
                    result = await blogCollection.updateOne(
                        { _id: new ObjectId(blogId), status: "published" },
                        {
                            $pull: { liked_by: email }
                        }
                    );
                    response = ({ action: 'disliked', result })
                }

                if (result.matchedCount === 0) {
                    return res.status(404).send({ message: "blog not found" });
                }
                if (result.modifiedCount === 0) {
                    response = { message: isLiked ? 'Already unliked' : 'Already liked by this user', action: isLiked ? 'unlike' : 'like' }
                }
                return res.status(200).send(response);
            }
            catch (error) {
                console.error("error liking blog", error);
                res.status(500).send({ message: "error liking blog", error });
            }
        });

        app.patch('/blog/:id/add-comment', verifyFBToken, async (req, res) => {
            const { email, comment } = req.body;
            const { id } = req.params;
            console.log(comment, id);
            if (!id || !comment || !email) {
                return res.status(400).send({ message: 'blogId or comment missing' });
            }
            try {
                const update = {
                    $push: {
                        comments: { commented_by: email, comment, created_at: new Date().toISOString() }
                    }
                };
                const result = await blogCollection.updateOne(
                    { _id: new ObjectId(id) }, update
                );
                if (result.modifiedCount < 1) {
                    return res.status(404).send({ message: 'no changes found', result });
                }
                res.status(201).send({ message: 'comment added.', result });
            }
            catch (error) {
                console.error('error adding new comment', error);
                res.status(500).send({ message: 'error adding new comment', error });
            }
        });



        // funding apis

        app.post('/funding-payments', verifyFBToken, async (req, res) => {
            const fundingInfo = req.body;
            console.log(fundingInfo);
            if (!fundingInfo) {
                return res.status(400).send({ message: "payment info not found" });
            }

            try {
                const result = await fundingCollection.insertOne(fundingInfo);
                if (!result.insertedId) {
                    return res.status(400).send("failed to add payment info in the database", result)
                }
                res.status(201).send({ message: "payment info added to the database", result });
            }
            catch (error) {
                console.error("error adding payment info in the database", error);
                res.status(500).send({ message: "error adding payment info in the database", error })
            }

        });


        app.get('/all-funding', verifyFBToken, verifyShared, async (req, res) => {
            try {
                const totalFunding = await fundingCollection.aggregate([
                    {
                        $group: {
                            _id: null,
                            totalAmount: { $sum: '$amount' }
                        }
                    }
                ]).toArray();
                console.log("total funding", totalFunding);

                if (!totalFunding.length) {
                    return res.status(404).send({ message: 'No funding made yet or not found' });
                }

                const { totalAmount } = totalFunding[0];
                res.status(200).send({ totalAmount });
            } catch (error) {
                console.error('Error getting all funding count:', error);
                res.status(500).send({ message: 'Internal server error', error: error.message });
            }
        });

        app.get('/funding', verifyFBToken, async (req, res) => {
            try {

                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 5;
                const skip = (page - 1) * limit;

                const totalItems = await fundingCollection.countDocuments();
                const fundingData = await fundingCollection
                    .find()
                    .sort({ donated_at: -1 })
                    .skip(skip)
                    .limit(limit)
                    .toArray();
                res.status(200).json({ data: fundingData, count: totalItems });
            }
            catch (error) {
                console.error('Error fetching funding data:', error);
                res.status(500).json({ message: 'Internal server error', error: error.message });
            }
        })




        // search donor api 
        app.get('/donors', async (req, res) => {
            try {
                const { bloodGroup, district, upazila, page = 1, limit = 10 } = req.query;
                const skip = (page - 1) * limit;

                const query = { role: "donor" };

                if (bloodGroup) query.blood_group = bloodGroup;
                if (district) query.district = district;
                if (upazila) query.upazila = upazila;

                const donors = await userCollection.find(query)
                    .skip(skip)
                    .limit(parseInt(limit))
                    .toArray();
                if (!donors) {
                    return res.status(404).send({ message: "no donor found in this area" });
                }

                const total = await userCollection.countDocuments(query);

                res.status(200).send({
                    donors,
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                });
            } catch (error) {
                console.error('Error fetching donors:', error);
                res.status(500).send({ error: 'Internal server error' });
            }
        });



        // message apis

        app.post('/contact-messages', async (req, res) => {
            const message = req.body;
            if (!message) {
                return res.status(400).send({ message: 'message not found' });
            }
            try {
                message.sent_at = new Date().toISOString();
                message.status = 'unread';
                const result = await messageCollection.insertOne(message);

                if (result.insertedId) {
                    res.status(201).send({ message: "message sent", result });
                } else {
                    return res.status(400).send('something went wrong. message not sent', result);
                }

            } catch (error) {
                console.error("error posting new message", error);
                res.status(500).send({ message: res.status(500).send({ message: "error posting new message", error }) });
            }
        });

        app.get('/all-messages', verifyFBToken, verifyShared, async (req, res) => {
            try {
                const messages = await messageCollection.find({ status: 'unread' }).sort({ sent_at: -1 }).toArray();
                if (!messages) {
                    return res.status(404).send({ message: 'no message found' })
                }
                res.status(200).send({ message: "messages found", messages });
            }
            catch (error) {
                console.error("error getting all messages", error);
                res, stripe(500).send({ message: "error getting all messages", error });
            }
        });

        app.patch('/message/:id/update', verifyFBToken, verifyShared, async (req, res) => {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send({ message: "message id not found" });
            }
            try {
                const result = await messageCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status: 'read'
                        }
                    }
                );
                if (result.modifiedCount < 1) {
                    return res.status(404).send({ message: 'update failed', result });
                }
                res.status(200).send({ message: 'status updated', result });
            }
            catch (error) {
                console.error('error updating message status', error);
                res.status(500).send({ message: 'error updating message status', error });
            }
        });

        app.delete("/message/:id/delete", verifyFBToken, verifyShared, async (req, res) => {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send({ message: 'message id not found' });
            }
            try {
                const result = await messageCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount < 1) {
                    return res.status(404).send({ message: 'something went wrong.failed to delete ,message' })
                }
                res.status(200).send({ message: 'deleted successfully', result });

            }
            catch (error) {
                console.error('error deleting message', error);
                res.status(500).send({ message: 'error deleting message', error });
            }
        })


        // payment intent

        app.post('/create-payment-intent', verifyFBToken, async (req, res) => {
            const amountInCents = req.body.amount;
            console.log(amountInCents)
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amountInCents,
                    currency: 'usd',
                    payment_method_types: ['card']
                });
                console.log(paymentIntent)
                res.json({ clientSecret: paymentIntent.client_secret });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });



        // subscriber api
        app.post('/newsletter-subscriptions', async (req, res) => {
            const { email } = req.body;
            // console.log(email);
            if (!email) {
                return res.status(400).json({ message: "email not found" });
            }
            try {
                const result = await subscriberCollection.insertOne({ email });
                if (result.insertedId) {
                    res.status(201).json(result);
                } else {
                    res.status(400).json({ message: "subscription failed" });
                }
            }
            catch (err) {
                console.error('error adding new subscriber', err);
                res.status(500).json({ message: "error while adding new subscriber" });
            }
        })



        // application apis
        app.post('/volunteer-applications', verifyFBToken, async (req, res) => {
            const applicationData = req.body;
            // console.log(applicationData);
            let data = {};
            if (!applicationData) {
                return res.status(400).json({ message: "application data not found" });
            } else {
                data = {
                    ...applicationData,
                    status: 'pending',
                    createAt: new Date().toISOString()
                }
            }

            try {
                const result = await applicationCollection.insertOne(data);
                if (!result.insertedId) {
                    return res.status(404).json({ message: "application not found" });
                }
                res.status(201).json(result);
            }
            catch (err) {
                console.error("error adding new application", err);
                res.status(500).json({ message: "error adding new application" });
            }

        });

        app.get('/volunteer-applications', verifyFBToken, verifyAdmin, async (req, res) => {
            try {
                const applications = await applicationCollection.find().toArray();
                if (!applications) {
                    return res.status(404).json({ message: "applications not found!" });
                }
                res.status(200).json(applications);
            }
            catch (err) {
                console.error('error getting all applications', err);
                res.status(500).json({ message: "error getting all applications" });
            }
        });

        app.patch('/volunteer-applications/:id', verifyFBToken, verifyAdmin, async (req, res) => {
            const { id } = req.params;
            const { status, email } = req.body;
            // console.log(id, status);
            if (!id || !status || !email) {
                return res.status(400).json({ message: 'missing information' });
            }
            try {
                if (status === 'rejected') {
                    const result = await applicationCollection.updateOne({
                        _id: new ObjectId(id)
                    }, {
                        $set: {
                            status: status
                        }
                    });
                    console.log(result);
                    if (result.modifiedCount > 0) {
                        return res.status(201).json(result);
                    } else {
                        return res.status(400).json({ message: 'failed to update status' });
                    }

                };

                if (status === 'accepted') {
                    const updateApplication = await applicationCollection.updateOne(
                        { _id: new ObjectId(id) },
                        {
                            $set: { status: status }
                        }
                    );

                    if (updateApplication.modifiedCount > 0) {
                        /**
                         * update user role in the user collection
                         */
                        const updateUserRole = await userCollection.updateOne(
                            { email },
                            {
                                $set: { role: 'volunteer' }
                            }
                        );
                        if (updateUserRole.modifiedCount > 0) {
                            res.status(201).json(updateUserRole);
                        }
                    }

                }

            }
            catch (err) {
                console.error("error updating application status", err);
                res.status(500).json({ message: "error updating application status" });
            }
        });


        // emergency request api
        app.post('/send-emergency-request/:id', verifyFBToken, async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            if (!id) {
                return res.status(400).json({ message: "request id not found" });
            }
            if (!status) {
                return res.status(400).json({ message: "status not found!" });
            }

            try {
                const filter = {
                    $set: { emergencyRequest: true }
                }
                const result = await requestCollection.updateOne(
                    {
                        _id: new ObjectId(id)
                    },
                    filter
                );
                console.log(result);
                res.status(201).json(result);
            }
            catch (err) {
                console.error("error requesting for emergency", err);
                res.status(500).json({ message: 'error requesting for emergency' });
            }

        });

        app.get('/user-requests/emergency-request', async (req, res) => {
            const { page, limit } = req.query;
            if (!page || !limit) {
                return res.status(400).json({ message: "missing queries" });
            }
            try {
                const pageCount = parseInt(page);
                const limitCount = parseInt(limit);
                const skip = (pageCount - 1) * limitCount;
                const filter = { emergencyRequest: true }
                const total = await requestCollection.countDocuments(filter);
                const emergencyRequests = await requestCollection.find(filter)
                    .sort({ donationDate: 1 })
                    .skip(skip)
                    .limit(limitCount)
                    .toArray();
                if (!emergencyRequests) {
                    return res.status(404).json({ message: "no emergency request found!" });
                }
                res.status(200).json({ message: 'found!', total, emergencyRequests });
            }
            catch (err) {
                console.error("error getting emergency request data", err);
                res.status(500).json({ message: "error getting emergency request data" });
            }
        });

        app.patch('/emergency/donation-requests/:id', verifyFBToken, verifyShared, async (req, res) => {
            const { id } = req.params;
            const payload = req.body;
            console.log(id);
            if (!id) {
                return res.status(400).json({ message: "id not found" });
            }
            if (!payload) {
                return res.status(400).json({ message: "payload not found" });
            }

            try {
                const { emergencyRequest, status } = payload;
                let updateDoc = {};
                if (status === 'accept') {
                    updateDoc = {
                        $set: {
                            status: 'emergency',
                            emergencyRequest
                        }
                    }
                }
                if (status === 'cancel') {
                    updateDoc = {
                        $set: {
                            emergencyRequest
                        }
                    }
                }
                const result = await requestCollection.updateOne(
                    { _id: new ObjectId(id) },
                    updateDoc
                );
                // console.log(result);
                if (!result?.modifiedCount > 0) {
                    return res.status(400).json({ message: "emergency request update failed" });
                };
                res.status(201).json(result);
            }
            catch (err) {
                console.error("error updating emergency request update", err);
                res.status(500).json({ message: "error updating emergency request" });
            }

        })




        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});
