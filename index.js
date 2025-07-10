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

