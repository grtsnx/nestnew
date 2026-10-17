import { Injectable } from '@nestjs/common';

import { getAutumnClient, requireAutumnClient, type Session } from 'src/lib';
import { handleResponse, rethrowAsHandleResponse } from 'src/middleware';

@Injectable()
export class BillingService {
  async syncCustomer(session: Session): Promise<never> {
    const autumn = getAutumnClient();
    if (!autumn) {
      throw new handleResponse(503, 'Billing is not configured');
    }
    try {
      const result = await autumn.customers.getOrCreate({
        customerId: session.user.id,
        email: session.user.email,
        name: session.user.name,
      });
      throw new handleResponse(200, 'Customer ready', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async checkAccess(
    session: Session,
    featureId: string,
    requiredBalance?: number,
  ): Promise<never> {
    try {
      const autumn = requireAutumnClient();
      const result = await autumn.check({
        customerId: session.user.id,
        featureId,
        requiredBalance,
      });
      throw new handleResponse(200, 'Access checked', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async attachPlan(session: Session, planId: string): Promise<never> {
    try {
      const autumn = requireAutumnClient();
      await autumn.customers.getOrCreate({
        customerId: session.user.id,
        email: session.user.email,
        name: session.user.name,
      });
      const result = await autumn.billing.attach({
        customerId: session.user.id,
        planId,
      });
      throw new handleResponse(200, 'Plan attached', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async trackUsage(
    session: Session,
    featureId: string,
    value = 1,
  ): Promise<never> {
    try {
      const autumn = requireAutumnClient();
      const result = await autumn.track({
        customerId: session.user.id,
        featureId,
        value,
      });
      throw new handleResponse(200, 'Usage recorded', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async getBalance(session: Session): Promise<never> {
    try {
      const autumn = requireAutumnClient();
      const result = await autumn.customers.getOrCreate({
        customerId: session.user.id,
        email: session.user.email,
        name: session.user.name,
      });
      throw new handleResponse(200, 'Balance loaded', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    rethrowAsHandleResponse(error);
  }
}
