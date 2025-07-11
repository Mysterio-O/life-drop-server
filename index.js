require('dotenv').config();
const cors = require('cors');
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = 3000;

app.use(express.json());
app.use(cors());


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


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

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

        app.get('/user', async (req, res) => {
            try {
                const { email } = req.query;
                console.log('email is->', email);
                let filter = {};
                if (!email) {
                    return res.status(400).send({ message: 'email not found!' });
                } else {
                    filter = { email };
                }
                console.log('filter is->', filter);
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

        // PATCH /user/update/:id
        app.patch('/user/update/:id', async (req, res) => {
            const userId = req.params.id;
            const updateFields = req.body;

            // Validate only allowed fields
            const allowedFields = ['name', 'division', 'district', 'upazila', 'blood_group'];
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



        // request apis
        app.post('/create-request', async (req, res) => {
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

        app.get('/requests', async (req, res) => {
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

        app.delete('/donation-requests/:id', async (req, res) => {
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
        app.get("/donation-requests", async (req, res) => {
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
                if (status === 'pending') {

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
                    status: 'pending'
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

        app.get('/donation-request/:id', async (req, res) => {
            const { id } = req.params;
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

        app.patch('/donation-requests/:id', async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;

            console.log(status);

            if (!id) {
                return res.status(400).send({ message: "donation request id not found" });
            }
            if (!status) {
                return res.status(400).send({ message: "status not found" });
            }


            try {
                const result = await requestCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: { status: status }
                    }
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
})
