const bcrypt = require("bcrypt");
const User = require("./user.model");
const { createTokens } = require("./tokenService");

const registerUser = async ({ name, email, password }) => {
    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        throw Object.assign(new Error("User already exists with this email"), { statusCode: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
        name,
        email,
        password: hashedPassword,
    });

    return user;
};

const loginUser = async ({ email, password }, metadata) => {
    const user = await User.findOne({ email });

    if (!user) {
        throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
    }

    const isPasswordValid = await bcrypt.compare(
        password,
        user.password
    );

    if (!isPasswordValid) {
        throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
    }
    const { accessToken, refreshToken, session } = await createTokens(user._id, metadata);

    return {
        user,
        tokens: { accessToken, refreshToken },
        session,
    };
};


module.exports = {
    registerUser,
    loginUser,
};
