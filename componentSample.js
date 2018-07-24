import React, { Component } from 'react'
import { reduxForm, SubmissionError, Field } from 'redux-form'
import { func, number, object, string } from 'prop-types'
import { connect } from 'react-redux'
import { Link } from 'react-router-dom'

import MessageHandler from 'messageHandler'
import { updateUser } from 'store/auth/actions'
import messages from 'utils/errors'
import { isValidAddress, minPasswordLength, match } from 'utils/validators'
import { formatAddress } from 'utils/helpers'

import routeWrapper from 'containers/RouteWrapper'
import Button from 'components/button/Button'
import ButtonGroup from 'components/button/ButtonGroup'
import Fieldset from 'components/fieldset'
import FormFeedback from 'components/FormFeedback'
import SoftAgeFields from 'components/SoftAgeFields'
import CheckboxFields from 'components/CheckboxFields'
import FieldsetItem from 'components/fieldset/FieldsetItem'
import Input from 'components/Input'
import Section from 'components/Modal/Section'
import AddressComplete from 'components/AddressComplete'

const mapStateToProps = ({ auth: { legalAge, buyingAllowed, user, loggedIn, signupError } }) => ({
  legalAge,
  buyingAllowed,
  initialValues: user && {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    address: user.address
      ? `${user.address}, ${user.city}, ${user.province}, ${user.country}, ${user.postalCode}`
      : user.postalCode,
    emailSubscription: user.emailSubscription,
    phoneSubscription: user.phoneSubscription
  },
  loggedIn,
  signupError,
  user
})

const mapActionCreators = {
  updateUser
}

@connect(mapStateToProps, mapActionCreators)
@reduxForm({ form: 'updateUser' })
class Account extends Component {
  static propTypes = {
    updateUser: func.isRequired,
    handleSubmit: func.isRequired,
    legalAge: number,
    signupError: string,
    user: object,
    change: func.isRequired
  }

  state = {
    changingAddress: false,
    changingPassword: false
  }

  updateUser = async ({ password, oldPassword, confirmPassword, address, ...user }) => {
    const { updateUser } = this.props

    // Format the CanadaPost address
    if (typeof address === 'object') {
      // The address will be an object only if the user changed it. Otherwise it's the prefilled string
      const { Line1, Province, PostalCode, City, CountryName } = address
      user = {
        ...user,
        address: Line1,
        province: Province,
        city: City,
        country: CountryName,
        postalCode: PostalCode
      }
    }

    // Password update
    if (password && oldPassword) {
      user = {
        ...user,
        oldPassword,
        password
      }
    }

    try {
      updateUser(user)
    } catch (err) {
      throw new SubmissionError(messages[err.response.data.error])
    }
  }

  changeAddress = inputField => {
    this.props.change('address', '')
    this.setState({ changingAddress: true })

    // Focus the field in a setTimeout to give React time to enable the field before
    setTimeout(() => {
      inputField.focus()
    }, 5)
  }

  changePassword = () => {
    this.setState({ changingPassword: true })
  }

  render() {
    const { handleSubmit, legalAge, signupError, user } = this.props
    const { changingAddress, changingPassword } = this.state
    if (!user) return null

    return (
      <form onSubmit={handleSubmit(this.updateUser)}>
        <Section title="Contact information">
          <Fieldset>
            <SoftAgeFields disableNames legalAge={legalAge} hideAge hideDob />

            <FieldsetItem sm="1-2">
              <Field
                component={Input}
                label="Phone number"
                placeholder="123-456-7890"
                name="phoneNumber"
                type="tel"
                normalize={val => (val ? val.match(/\d|-/g).join('') : val)}
              />
            </FieldsetItem>

            <FieldsetItem>
              <Field
                disabled={!changingAddress}
                component={AddressComplete}
                label="Address"
                placeholder="Start typing..."
                name="address"
                validate={changingAddress ? isValidAddress : null}
                format={formatAddress}
                addOn={
                  !changingAddress && (
                    <button onClick={this.changeAddress}>
                      <small>Change</small>
                    </button>
                  )
                }
                onBlur={(event, newValue, previousValue) => {
                  if (typeof newValue === 'string' && typeof previousValue === 'object') event.preventDefault()
                }}
              />
            </FieldsetItem>
          </Fieldset>
        </Section>

        <Section title="Subscription Preferences">
          <Fieldset>
            <CheckboxFields onlyShowUpdateFields />
          </Fieldset>
        </Section>

        <Section title="Password">
          <Fieldset>
            {changingPassword ? (
              <>
                <FieldsetItem sm="1-2">
                  <Field
                    component={Input}
                    label="Current password"
                    placeholder="••••••••"
                    type="password"
                    name="oldPassword"
                  />
                </FieldsetItem>

                <FieldsetItem sm="1-2">
                  <Field
                    component={Input}
                    label="New password"
                    placeholder="••••••••"
                    type="password"
                    name="password"
                    validate={minPasswordLength}
                  />
                </FieldsetItem>

                <FieldsetItem sm="1-2">
                  <Field
                    component={Input}
                    label="Confirm new password"
                    placeholder="••••••••"
                    type="password"
                    name="confirmPassword"
                    validate={match}
                  />
                </FieldsetItem>
              </>
            ) : (
              <>
                <FieldsetItem>
                  <Button secondary onClick={this.changePassword}>
                    Change password
                  </Button>
                </FieldsetItem>
              </>
            )}

            {signupError === 'generic' && (
              <FieldsetItem>
                <FormFeedback>Something went wrong. We're looking into it. Please try again later.</FormFeedback>
              </FieldsetItem>
            )}

            {signupError === 'invalidPassword' && (
              <FieldsetItem>
                <FormFeedback>You didn't input the correct current password</FormFeedback>
              </FieldsetItem>
            )}

            {signupError === 'emailAlreadyExists' && (
              <FieldsetItem>
                <FormFeedback>
                  An account already exists with that email. Did you mean to <Link to="/login">login</Link> instead?
                </FormFeedback>
              </FieldsetItem>
            )}

            <FieldsetItem>
              <ButtonGroup>
                <Button type="submit" primary>
                  Save
                </Button>
                <Button secondary>
                  <Link to="/" onClick={() => MessageHandler.hideModal()}>
                    Cancel
                  </Link>
                </Button>
              </ButtonGroup>
            </FieldsetItem>
          </Fieldset>
        </Section>

        <Section>
          <p>
            <a href="mailto:support@glo.ca" target="_top">
              Contact us
            </a>{' '}
            if you would like to close your account.
          </p>
        </Section>
      </form>
    )
  }
}

export default routeWrapper(Account)
