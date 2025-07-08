require('dotenv').config();
const cors = require('cors');
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
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


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();


        app.post('/users', async (req, res) => {
            try {
                const userInfo = req.body;
                if (!userInfo) {
                    return res.status(400).send({ message: 'user info not found' });
                }else{
                    userInfo.role="donor"
                }

                const userEmail = userInfo.email;
                const existingUser = await userCollection.findOne({ email: userEmail });
                if (existingUser) {
                    return res.status(400).send({ message: 'already user with this email exists!' })
                }

                const newUser = await userCollection.insertOne(userInfo);
            }
            catch (error) {
                res.status(500).send({ message: 'error inserting new user!', error });
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