import passport from 'passport'
import User from '../models/User'

var LocalStrategy = require('passport-local').Strategy
var FacebookStrategy = require('passport-facebook').Strategy

passport.serializeUser(function (user, done) {
  done(null, user.id)
})
passport.deserializeUser(function (id, done) {
  new User({ id: id}).fetch().then(function (user) {
    done(null, user)
  })
})

// Sign in with Email and Password
passport.use(new LocalStrategy({ usernameField: 'email' }, function (email, password, done) {
  new User({ email: email })
    .fetch()
    .then(function (user) {
      if (!user) {
        return done(null, false, { msg: 'The email address ' + email + ' is not associated with any account. ' +
        'Double-check your email address and try again.' })
      }
      user.comparePassword(password, function (err, isMatch) {
        if (!isMatch) {
          return done(null, false, { msg: 'Invalid email or password' })
        }
        return done(null, user)
      })
    })
}))

// Sign in with Facebook
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_ID,
  clientSecret: process.env.FACEBOOK_SECRET,
  callbackURL: '/auth/facebook/callback',
  profileFields: ['name', 'email', 'gender', 'location'],
  passReqToCallback: true
}, function (req, accessToken, refreshToken, profile, done) {
  if (req.user) {
    new User({ facebook: profile.id })
      .fetch()
      .then(function (user) {
        if (user) {
          req.res.flash('errors', [{ msg: 'There is already an existing account linked with Facebook that belongs to you.' }])
          return done(null)
        }
        new User({ id: req.user.id })
          .fetch()
          .then(function (user) {
            user.set('name', user.get('name') || profile.name.givenName + ' ' + profile.name.familyName)
            user.set('gender', user.get('gender') || profile._json.gender)
            user.set('picture', user.get('picture') || 'https://graph.facebook.com/' + profile.id + '/picture?type=large')
            user.set('facebook', profile.id)
            user.save(user.changed, { patch: true }).then(function () {
              req.res.flash('success', 'Your Facebook account has been linked.')
              done(null, user)
            })
          })
      })
  } else {
    new User({ facebook: profile.id })
      .fetch()
      .then(function (user) {
        if (user) {
          return done(null, user)
        }
        new User({ email: profile._json.email })
          .fetch()
          .then(function (user) {
            if (user) {
              req.res.flash('errors', [{ msg: user.get('email') + ' is already associated with another account.' }])
              return done()
            }
            user = new User()
            user.set('name', profile.name.givenName + ' ' + profile.name.familyName)
            user.set('email', profile._json.email)
            user.set('gender', profile._json.gender)
            user.set('location', profile._json.location && profile._json.location.name)
            user.set('picture', 'https://graph.facebook.com/' + profile.id + '/picture?type=large')
            user.set('facebook', profile.id)
            user.save().then(function (user) {
              done(null, user)
            })
          })
      })
  }
}))
