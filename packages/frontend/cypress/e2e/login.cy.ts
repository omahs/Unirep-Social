import { startServer } from '../support/e2e'

describe('visit and interact with home page', () => {
    const serverUrl = Cypress.env('serverUrl')
    const ethProvider = Cypress.env('ethProvider')

    Cypress.on('uncaught:exception', (err, runnable) => {
        return false
    })

    beforeEach(() => {
        // deploy unirep and unirep social contract
        const context = startServer()
        Object.assign(context)

        cy.intercept('GET', `${serverUrl}/api/post?*`, {
            body: {
                posts: 'string',
            },
        }).as('getApiContent')
        cy.intercept('GET', `${serverUrl}/api/config`, {
            body: {
                unirepAddress: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
                unirepSocialAddress:
                    '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
            },
        }).as('getApiConfig')
        cy.intercept(`${ethProvider}*`, (req) => {
            // conditonal logic to return different responses based on the request url
            console.log(req.body)
            const { method, params, id } = req.body
            if (method === 'eth_chainId') {
                req.reply({
                    body: {
                        id: 1,
                        jsonrpc: '2.0',
                        result: '0x111111',
                    },
                })
            } else if (
                method === 'eth_call' &&
                params[0]?.data === '0x79502c55'
            ) {
                req.reply({
                    body: {
                        id,
                        jsonrpc: '2.0',
                        result:
                            '0x' +
                            Array(10 * 64)
                                .fill(0)
                                .map((_, i) => (i % 64 === 63 ? 1 : 0))
                                .join(''),
                    },
                })
            } else if (method === 'eth_call') {
                // other uint256 retrievals
                req.reply({
                    body: {
                        id,
                        jsonrpc: '2.0',
                        result: '0x0000000000000000000000000000000000000000000000000000000000000001',
                    },
                })
            } else {
                req.reply({
                    body: { test: 'test' },
                })
            }
            req.reply({
                body: {
                    id,
                    jsonrpc: '2.0',
                    result: '0x0000000000000000000000000000000000000000000000000000000000000001',
                },
            })
        }).as('ethProvider')
    })

    it.skip('navigate to the login page and login a user', () => {
        cy.visit('/')

        // quickly tests if signup page loads
        cy.findByText('Sign in').click()
        cy.findByRole('textbox').type('test')
        cy.get('*[class^="login-page"]').should('be.visible')
        cy.get('#close-icon').click()

        cy.findByText('Sign in').click()
        cy.findByRole('textbox').type('testprivatekey')
        cy.get('*[class^="loading-btn"]').click()
    })
})

// sends a post request to geth node every ~70-500ms. Why?