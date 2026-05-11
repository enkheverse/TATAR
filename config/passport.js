const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const supabase = require('./supabase');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const name = profile.displayName;
    const photo = profile.photos[0]?.value || '';

    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existing) return done(null, existing);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ email, name, photo, role: 'tatar', status: 'pending' })
      .select()
      .single();

    if (error) return done(error);
    return done(null, newUser);
  } catch (e) {
    return done(e);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  const { data } = await supabase.from('users').select('*').eq('id', id).single();
  done(null, data);
});

module.exports = passport;
