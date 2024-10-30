async function addTutor() {
    const name = 'Kevin Tutor';
    const email = 'kevin-tutor@gmail.com';
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
    } catch (error) {
        console.error('Error adding tutor:', error);
    }
}

addTutor();