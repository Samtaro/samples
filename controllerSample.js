import passport from 'koa-passport'
import crypto from 'crypto'
import moment from 'moment'
import Promise from 'bluebird'

import User from 'models/user'
import config from 'config'
import { getJumioUser, initiateNetverifyTransaction } from 'lib/jumio'
import * as emails from 'lib/sendgrid'
import { googleMapsClient } from 'lib/google'
import { io } from 'lib/socket'

const randomBytes = Promise.promisify(crypto.randomBytes)

export async function authUser(ctx, next) {
  return passport.authenticate('local', (err, user) => {
    if (err || !user) {
      console.log(err)
      ctx.throw(401, 'loginFailure')
    }

    const token = user.generateToken()

    ctx.body = {
      token,
      user: user.toJSON()
    }
  })(ctx, next)
}

export async function requestRecoveryEmail(ctx) {
  const { email } = ctx.request.body
  const user = await User.query()
    .where({ email })
    .first()
  if (!user) ctx.throw(400, 'emailNotFound')
  const buf = await randomBytes(16)
  const token = buf.toString('hex')
  const expiry = moment()
    .add(1, 'hours')
    .utc()
    .format()
  await user.$query().patch({
    passwordResetToken: token,
    resetTokenExpiry: expiry
  })
  const resetLink = `${config.authUrl}/reset-password?reset_token=${token}`

  await emails.resetPassword(user, resetLink)
  ctx.status = 200
  ctx.body = {}
}

export async function resetPassword(ctx) {
  const { passwordResetToken, password } = ctx.request.body
  const user = await User.query()
    .where({ password_reset_token: passwordResetToken })
    .first()

  if (!user) return ctx.throw(404, 'token not found.')
  if (!moment().isBefore(user.resetTokenExpiry)) {
    await user.$query().patch({
      resetTokenExpiry: null,
      passwordResetToken: null
    })

    return ctx.throw(403, 'token expired')
  }
  await user.$query().patch({
    resetTokenExpiry: null,
    passwordResetToken: null,
    password
  })
  const token = user.generateToken()
  ctx.body = {
    token,
    user
  }
}

export async function geocodeAddress(ctx) {
  const { address } = ctx.request.body
  const { json: { results } } = await googleMapsClient.geocode({ address }).asPromise()
  if (!results.length) {
    ctx.body = { valid: false }
  } else {
    ctx.body = {
      valid: true,
      addressComponents: results[0].address_components
    }
  }
}

export async function reverseGeocode(ctx) {
  const { latlng } = ctx.request.body
  const { json: { results } } = await googleMapsClient.reverseGeocode({ latlng }).asPromise()
  if (!results.length) {
    ctx.body = { valid: false }
  } else {
    ctx.body = {
      valid: true,
      addressComponents: results[0].address_components
    }
  }
}

export async function getJumioAuthToken(ctx) {
  const { uuid } = ctx.query
  try {
    const authToken = await initiateNetverifyTransaction(uuid)
    ctx.body = { jumioAuthToken: authToken }
  } catch (e) {
    ctx.throw(400, e)
  }
}

export async function jumioHook(ctx) {
  const { jumioIdScanReference, merchantIdScanReference } = ctx.query
  getJumioUser(jumioIdScanReference, merchantIdScanReference)
  io.to(merchantIdScanReference).emit('documentsSent')
  ctx.body = 'Success'
}