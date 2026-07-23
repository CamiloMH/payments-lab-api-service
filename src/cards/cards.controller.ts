import { Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { DEFAULT_WEB_BASE_URL, WEB_ENROLL_RETURN_PATH } from '../common/config.defaults';
import { SENSITIVE_THROTTLE } from '../common/throttling/throttle.const';
import { DemoSession } from '../session/entities/demo-session.entity';
import { CurrentSession } from '../session/session.decorator';
import { CardsService } from './cards.service';
import { InscribedCardResponse } from './dto/inscribed-card.response';
import { PaymentInitiationResponse } from '../payments/dto/payment-initiation.response';

/**
 * Ciclo de vida de tarjetas Oneclick: inscribir (redirect a Transbank),
 * listar y eliminar. El callback de retorno de la inscripción no es un
 * endpoint invocable por un cliente HTTP normal (lo llama Transbank), por
 * eso queda excluido de la documentación.
 */
@ApiTags('cards')
@Controller({ path: 'cards', version: '1' })
export class CardsController {
  constructor(
    private readonly cardsService: CardsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('enroll')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary: 'Inicia la inscripción de una tarjeta',
    description:
      'Crea un pivot y devuelve un `PaymentInitiation` (siempre `form_post` con Oneclick) que el ' +
      'cliente debe enviar para redirigir al usuario al formulario de inscripción de Transbank.',
  })
  @ApiResponse({
    status: 201,
    description: 'Inscripción iniciada.',
    type: PaymentInitiationResponse,
  })
  async enroll(@CurrentSession() session: DemoSession): Promise<PaymentInitiationResponse> {
    return PaymentInitiationResponse.from(await this.cardsService.initiateEnrollment(session));
  }

  // El token de la inscripción se guardó en el pivot al iniciarla (ver
  // `CardsService.initiateEnrollment`), así que el callback solo necesita el
  // `?pivot=` para resolver cuál inscripción finalizar; no lee `TBK_TOKEN`
  // del retorno de Transbank (que llega vacío según el flujo).
  @Get('callback/transbank')
  @ApiExcludeEndpoint()
  handleCallbackGet(@Query('pivot') pivotId: string, @Res() res: Response) {
    return this.handleCallback(pivotId, res);
  }

  @Post('callback/transbank')
  @ApiExcludeEndpoint()
  handleCallbackPost(@Query('pivot') pivotId: string, @Res() res: Response) {
    return this.handleCallback(pivotId, res);
  }

  @Get()
  @ApiOperation({
    summary: 'Tarjetas inscritas de la sesión',
    description: 'Lista solo las tarjetas activas (no incluye las eliminadas).',
  })
  @ApiResponse({
    status: 200,
    description: 'Tarjetas activas de la sesión.',
    type: [InscribedCardResponse],
  })
  async list(@CurrentSession() session: DemoSession): Promise<InscribedCardResponse[]> {
    const cards = await this.cardsService.list(session.id);
    return cards.map(InscribedCardResponse.from);
  }

  @Delete(':id')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary: 'Elimina una tarjeta inscrita',
    description:
      'Elimina la inscripción en Transbank y marca la tarjeta como `deleted` localmente.',
  })
  @ApiParam({ name: 'id', description: 'Id de la tarjeta inscrita a eliminar.' })
  @ApiResponse({ status: 200, description: 'Tarjeta eliminada.' })
  @ApiResponse({ status: 403, description: 'La tarjeta no pertenece a la sesión actual.' })
  @ApiResponse({ status: 404, description: 'No existe una tarjeta con ese id.' })
  delete(@CurrentSession() session: DemoSession, @Param('id') id: string): Promise<void> {
    return this.cardsService.delete(id, session);
  }

  private async handleCallback(pivotId: string, res: Response): Promise<void> {
    const result = await this.cardsService.confirmEnrollment(pivotId);
    const webBaseUrl = this.configService.get<string>('WEB_BASE_URL') ?? DEFAULT_WEB_BASE_URL;
    const status = result.responseCode === 0 ? 'success' : 'error';
    // La inscripción se abre en pestaña nueva; ésta vuelve al checkout localizado
    // (ruta que existe en dev y en el export estático). La pestaña original ya
    // detecta la tarjeta nueva por WebSocket (`card.enrolled`).
    res.redirect(302, `${webBaseUrl}${WEB_ENROLL_RETURN_PATH}?enroll=${status}`);
  }
}
