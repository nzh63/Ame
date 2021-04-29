import dotenv from 'dotenv';
[
    '.env',
    '.env.local',
    '.env.test',
    '.env.test.local'
].forEach(path => {
    try {
        dotenv.config({ path });
    } catch (e) { }
});
