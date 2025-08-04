# LifeDrop Server - Blood Donation Management System

## Table of Contents
- [Project Overview](#project-overview)
- [API Documentation](#api-documentation)
  - [User Management](#user-management)
  - [Blog Management](#blog-management)
  - [Blood Request Management](#blood-request-management)
  - [Donation Management](#donation-management)
  - [Message Management](#message-management)
- [Database Schema](#database-schema)
- [Setup Instructions](#setup-instructions)
- [Dependencies](#dependencies)
- [To install all dependencies](#to-install-all-dependencies)
- [To install development dependencies](#to-install-development-dependencies)

## Project Overview

LifeDrop is a blood donation management system that connects blood donors with recipients in need. The system facilitates blood requests, manages donor information, tracks donations, and provides educational content through blogs. The backend is built with Node.js, Express, and MongoDB.

Key Features:
- User registration and management (donors, volunteers, admins)
- Blood request creation and tracking
- Donation tracking and history
- Blog publishing system
- Messaging system
- Donation funding system

## API Documentation

### User Management

#### `GET /users`
- **Description**: Retrieves all users from the database
- **Response**: Array of user objects
- **Example Response**:
  ```json
  [
    {
      "_id": "686d3fea3cb293f055afc485",
      "name": "user",
      "email": "user@gmail.com",
      "division": "Sylhet",
      "district": "Habiganj",
      "upazila": "Lakhai",
      "created_at": "2025-07-08T15:57:21.404Z",
      "last_log_in": "2025-07-08T15:57:21.404Z",
      "role": "donor",
      "blood_group": "A+",
      "last_update": "2025-07-14T12:42:58.965Z",
      "photoURL": "https://i.ibb.co/qYNWdngM/475050739-3963937503923330-44984072635914802…",
      "status": "active"
    }
  ]
  ```
### `GET /users/:email`
- **Description**:Retrieves a specific user by email
- **Parameters**: Email address
- **Response**: Email address
- **Example Response**: Same as GET /users but for a single user
  ```json
  [
    {
      "name": "New User",
      "email": "new@example.com",
      "division": "Dhaka",
      "district": "Dhaka",
      "upazila": "Mirpur",
      "role": "donor",
      "blood_group": "B+"
    }
  ]
  ```
- **Response**: Created user object

### `DELETE /users/:email`
- **Description**: Deletes a user (soft delete by changing status)
- **Parameters**: Email address
- **Response**: Response: Success message

## Blog Management

### ✅ Get All Blogs
**GET** `/blogs`  
**Description:** Retrieves all published blogs  

**Response:**  
Returns an array of blog objects  

**Example Response:**
```json
[
  {
    "_id": "6873a4774a193e686360418f",
    "title": "test blog 5",
    "thumbnail": "https://i.ibb.co/KjQNhrVT/475e955c-2891-4cf5-b426-bfb4061d54e8.jpg",
    "content": "<p><strong>this is test blog 5</strong></p>",
    "created_by": "example@gmail.com",
    "status": "published",
    "created_at": "2025-07-13T12:20:07.829Z",
    "updated_at": "2025-07-13T15:31:57.987Z",
    "updated_by": "example@gmail.com",
    "liked_by": [],
    "comments": []
  }
]
```

### ✅ Create a New Blog

**POST** `/blogs`  
**Description:** Creates a new blog post  

**Request Body:**
```json
{
  "title": "New Blog",
  "content": "<p>Blog content</p>",
  "thumbnail": "https://example.com/image.jpg",
  "created_by": "author@example.com"
}
```

### ✅ Update a Blog Post

**PATCH** `/blogs/:id`  
**Description:** Updates a blog post  

**Parameters:**  
- `:id` — Blog ID  

**Request Body:**  
Fields to update  
```json
{
  "title": "Updated Title",
  "content": "<p>Updated content</p>",
  "thumbnail": "https://example.com/updated-image.jpg",
  "status": "published"
}
```

### ✅ Delete a Blog Post

**DELETE** `/blogs/:id`  
**Description:** Deletes a blog post  

**Parameters:**  
- `:id` — Blog ID  

**Response:**  
Success message  
```json
{
  "message": "Blog deleted successfully"
}
```

## 🩸 Blood Request Management

---

### ✅ Get All Blood Requests  

**GET** `/requests`  
**Description:** Retrieves all blood requests  

**Response:**  
Array of request objects  

```json
[
  {
    "_id": "6870a64774a9e883a9cae6ba",
    "requesterName": "test4",
    "requesterEmail": "test4@gmail.com",
    "recipientName": "ariha",
    "division": "Rajshahi",
    "district": "Rajshahi",
    "upazila": "Bagmara",
    "hospitalName": "Rajshahi Medical college",
    "address": "Medical college road",
    "bloodGroup": "A-",
    "donationDate": "2025-07-17",
    "donationTime": "15:00",
    "requestMessage": "delivery case. blood need at the time of delivery...",
    "status": "pending",
    "createdAt": "2025-07-11T05:51:03.147Z"
  }
]
```

### ✅ Create a New Blood Request
- **POST** `/requests`
- **Description**: Creates a new blood request
- **Request Body:**
```json
[
    {
  "requesterName": "Requester Name",
  "requesterEmail": "requester@example.com",
  "recipientName": "Recipient Name",
  "division": "Dhaka",
  "district": "Dhaka",
  "upazila": "Mirpur",
  "hospitalName": "Hospital Name",
  "address": "Hospital Address",
  "bloodGroup": "A+",
  "donationDate": "2025-07-20",
  "donationTime": "14:00",
  "requestMessage": "Emergency need for blood"
 }
]
```
- **Response:** Returns the created blood request object

### ✅ Update Blood Request Status  

**PATCH** `/requests/:id/status`  
**Description:** Updates request status (`pending`, `in_progress`, `done`, `canceled`)  

**Parameters:**  
- `:id` — Request ID  

**Request Body:**
```json
{
  "status": "in_progress",
  "donor_email": "donor@example.com",
  "donor_name": "Donor Name",
  "donor_number": "01234567890"
}
```

## Donation Management

### ✅ Get All Donation Records  

**GET** `/donations`  
**Description:** Retrieves all donation records  

**Response:**  
Returns an array of donation objects  

**Example Response:**
```json
[
  {
    "_id": "6875fd457af2784088974626",
    "donated_by": "admin@gmail.com",
    "donated_at": "2025-07-15T07:03:33.919Z",
    "amount": 250,
    "currency": "usd",
    "payment_method": ["card"]
  }
]
```

### ✅ Create a New Donation  

**POST** `/donations`  
**Description:** Records a new donation  

**Request Body:**
```json
{
  "donated_by": "donor@example.com",
  "amount": 100,
  "currency": "usd",
  "payment_method": ["card"]
}
```

## 📬 Message Management

---

### ✅ Get All Messages  

**GET** `/messages`  
**Description:** Retrieves all messages  

**Response:**  
Array of message objects  

**Example Response:**
```json
[
  {
    "_id": "68763107638800c0eca9f6c4",
    "name": "test2",
    "email": "test2@gmail.com",
    "message": "test message 1",
    "sent_at": "2025-07-15T10:44:23.871Z",
    "status": "unread"
  }
]
```

### ✅ Create a New Message  

**POST** `/messages`  
**Description:** Creates a new message  

**Request Body:**
```json
{
  "name": "Sender Name",
  "email": "sender@example.com",
  "message": "This is a test message"
}
```

### ✅ Update Message Status  
**PATCH** `/messages/:id/status`  
**Description:** Updates message status (unread, read)  

**Parameters:**  
- `:id` — Message ID  

**Request Body:**  
```json
{
  "status": "read"
}
```

## Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  division: String,
  district: String,
  upazila: String,
  created_at: Date,
  last_log_in: Date,
  role: String, // 'admin', 'volunteer', 'donor'
  blood_group: String,
  last_update: Date,
  photoURL: String,
  status: String // 'active', 'inactive'
}
```
### Blogs Collection

```javascript
{
  _id: ObjectId,
  title: String,
  thumbnail: String,
  content: String,
  created_by: String, // email
  status: String, // 'published', 'draft'
  created_at: Date,
  updated_at: Date,
  updated_by: String, // email
  liked_by: Array, // array of user emails
  comments: Array // array of comment objects
}
```
### Requests Collection

```javascript
{
  _id: ObjectId,
  requesterName: String,
  requesterEmail: String,
  recipientName: String,
  recipientNumber: String,
  division: String,
  district: String,
  upazila: String,
  hospitalName: String,
  address: String,
  bloodGroup: String,
  donationDate: Date,
  donationTime: String,
  requestMessage: String,
  status: String, // 'pending', 'in_progress', 'done', 'canceled'
  createdAt: Date,
  donor_email: String,
  donor_name: String,
  donor_number: String,
  donated_at: Date,
  donated_by: String,
  canceled_at: Date
}
```
### Donations Collection

```javascript
{
  _id: ObjectId,
  donated_by: String, // email
  donated_at: Date,
  amount: Number,
  currency: String,
  payment_method: Array // ['card' only for now]
}
```
### Messages Collection

```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  message: String,
  sent_at: Date,
  status: String // 'unread', 'read'
}
```

## Setup Instructions

### Clone the repository:

```bash
git clone https://github.com/yourusername/lifedrop-server.git
cd lifedrop-server
```
### Install dependencies:

```bash
npm install
```
### Create a `.env` file in the root directory with the following variables:

```env
 MONGODB_URI=your_mongodb_connection_string
PORT=3000
FIREBASE_SERVICE_ACCOUNT=path_to_firebase_service_account.json
STRIPE_SECRET_KEY=your_stripe_secret_key
```
### Start the server:

```bash
npm start
```
The server will be running at [http://localhost:3000](http://localhost:3000)


### Dependencies

- **express**: Web framework for Node.js  
- **mongodb**: MongoDB driver for Node.js  
- **firebase-admin**: Firebase Admin SDK for authentication  
- **cors**: Middleware for enabling CORS  
- **dotenv**: Loads environment variables from .env file  
- **stripe**: Stripe API for payment processing  

## Development Dependencies

- **nodemon**: Automatically restarts the server during development  


### To install all dependencies:

```bash
npm install cors dotenv express firebase-admin mongodb stripe
```

### To install development dependencies:

```bash
npm install --save-dev nodemon
```


**Added to public repository**