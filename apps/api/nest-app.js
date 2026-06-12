import 'reflect-metadata'
import { All, Controller, Module, Req, Res } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import contractsHandler from './contracts.js'
import feedbackHandler from './feedback.js'
import parseQuoteHandler from './parse-quote.js'
import pricingHandler from './pricing.js'
import pricingAdminHandler from './pricing-admin.js'
import quotesHandler from './quotes.js'

function bindAllRoute(controller, methodName) {
  const descriptor = Object.getOwnPropertyDescriptor(controller.prototype, methodName)
  All()(controller.prototype, methodName, descriptor)
  Req()(controller.prototype, methodName, 0)
  Res()(controller.prototype, methodName, 1)
}

class QuotesController {
  handle(req, res) {
    return quotesHandler(req, res)
  }
}
Controller('api/quotes')(QuotesController)
bindAllRoute(QuotesController, 'handle')

class ContractsController {
  handle(req, res) {
    return contractsHandler(req, res)
  }
}
Controller('api/contracts')(ContractsController)
bindAllRoute(ContractsController, 'handle')

class FeedbackController {
  handle(req, res) {
    return feedbackHandler(req, res)
  }
}
Controller('api/feedback')(FeedbackController)
bindAllRoute(FeedbackController, 'handle')

class ParseQuoteController {
  handle(req, res) {
    return parseQuoteHandler(req, res)
  }
}
Controller('api/parse-quote')(ParseQuoteController)
bindAllRoute(ParseQuoteController, 'handle')

class PricingAdminController {
  handle(req, res) {
    return pricingAdminHandler(req, res)
  }
}
Controller('api/pricing-admin')(PricingAdminController)
bindAllRoute(PricingAdminController, 'handle')

class PricingController {
  handle(req, res) {
    return pricingHandler(req, res)
  }
}
Controller('api/pricing')(PricingController)
bindAllRoute(PricingController, 'handle')

export class ApiModule {}
Module({
  controllers: [
    QuotesController,
    ContractsController,
    FeedbackController,
    ParseQuoteController,
    PricingAdminController,
    PricingController,
  ],
})(ApiModule)

let nestAppPromise
const apiBodyLimit = process.env.API_JSON_BODY_LIMIT || '12mb'

function configureApiApp(app) {
  app.enableCors()
  app.useBodyParser('json', { limit: apiBodyLimit })
  app.useBodyParser('urlencoded', { extended: true, limit: apiBodyLimit })
}

export async function createNestApiApp() {
  if (!nestAppPromise) {
    nestAppPromise = NestFactory.create(ApiModule, { bodyParser: false, logger: ['error', 'warn'] })
      .then(async app => {
        configureApiApp(app)
        await app.init()
        return app
      })
  }

  return nestAppPromise
}

export async function createNestApiMiddleware() {
  const app = await createNestApiApp()
  return app.getHttpAdapter().getInstance()
}
