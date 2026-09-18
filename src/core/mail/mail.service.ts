import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

import { ConfigService } from '@/core/config/config.service';

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.get('SMTP_FROM');

    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST'),
      port: Number(config.get('SMTP_PORT')),
      secure: String(config.get('SMTP_SECURE')) === 'true',
      auth: {
        user: config.get('SMTP_USER'),
        pass: config.get('SMTP_PASSWORD'),
      },
    });
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown mail error';
      this.logger.error(`Failed to send email to ${options.to}: ${message}`);
      throw error;
    }
  }

  async sendRegistrationOtp(to: string, code: string): Promise<void> {
    const subject = 'Confirm your registration';
    const text = `Your confirmation code is ${code}. It expires in 10 minutes.`;
    const html = `<p>Your confirmation code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`;

    await this.sendMail({ to, subject, text, html });
  }

  async sendEmailChangeOtp(to: string, code: string): Promise<void> {
    const subject = 'Confirm your email change';
    const text = `Your confirmation code is ${code}. It expires in 10 minutes.`;
    const html = `<p>Your confirmation code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`;
    await this.sendMail({ to, subject, text, html });
  }

  async sendAccountDeletionOtp(to: string, code: string): Promise<void> {
    const subject = 'Confirm account deletion';
    const text = `Your confirmation code is ${code}. It expires in 10 minutes.`;
    const html = `<p>Your confirmation code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`;
    await this.sendMail({ to, subject, text, html });
  }
}
