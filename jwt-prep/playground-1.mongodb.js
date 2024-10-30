// Use the correct database
use('test');  // Replace 'test' with your database name if needed

// Drop the email_1 index from the userprofiles collection
db.getCollection('userprofiles').dropIndex('email_1');


