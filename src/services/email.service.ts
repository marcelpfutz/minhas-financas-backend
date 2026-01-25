/**
 * Serviço de Email
 * Gerencia o envio de emails do sistema
 */

import nodemailer from 'nodemailer';

// Configuração do transporter de email
const createTransporter = () => {
  // Em produção, use credenciais reais (Gmail, SendGrid, AWS SES, etc.)
  // Em desenvolvimento, pode usar Ethereal Email (emails de teste)
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Configuração para produção (exemplo com Gmail)
    // IMPORTANTE: Configure as variáveis de ambiente no .env
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outros
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Configuração para desenvolvimento (console apenas)
    // Em dev real, você pode usar Ethereal Email ou Mailtrap
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
        pass: process.env.SMTP_PASS || 'ethereal.password',
      },
    });
  }
};

/**
 * Interface para envio de email
 */
interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Envia um email
 */
export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Minhas Finanças" <noreply@minhasfinancas.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Remove HTML tags para versão texto
    };

    const info = await transporter.sendMail(mailOptions);
    
    // Em desenvolvimento, mostra o preview URL do Ethereal
    if (process.env.NODE_ENV !== 'production') {
      console.log('📧 Email enviado (DEV):', nodemailer.getTestMessageUrl(info));
      console.log('Para:', options.to);
      console.log('Assunto:', options.subject);
    } else {
      console.log('📧 Email enviado com sucesso para:', options.to);
    }
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error);
    throw new Error('Erro ao enviar email');
  }
};

/**
 * Envia email de recuperação de senha
 */
export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetUrl: string
): Promise<void> => {
  const subject = 'Recuperação de Senha - Minhas Finanças';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recuperação de Senha</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background-color: #f8f9fa;
          border-radius: 10px;
          padding: 30px;
          margin: 20px 0;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .emoji {
          font-size: 48px;
          margin-bottom: 10px;
        }
        h1 {
          color: #1e40af;
          margin: 0;
          font-size: 24px;
        }
        .content {
          background-color: white;
          padding: 25px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .button {
          display: inline-block;
          padding: 14px 28px;
          background-color: #3b82f6;
          color: white !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 20px 0;
          text-align: center;
        }
        .button:hover {
          background-color: #2563eb;
        }
        .warning {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          text-align: center;
          color: #6b7280;
          font-size: 12px;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }
        .link {
          color: #3b82f6;
          word-break: break-all;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="emoji">🔐</div>
          <h1>Recuperação de Senha</h1>
        </div>
        
        <div class="content">
          <p>Olá, <strong>${name}</strong>!</p>
          
          <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Minhas Finanças</strong>.</p>
          
          <p>Para criar uma nova senha, clique no botão abaixo:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Redefinir Minha Senha</a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280;">
            Ou copie e cole este link no seu navegador:<br>
            <a href="${resetUrl}" class="link">${resetUrl}</a>
          </p>
          
          <div class="warning">
            <strong>⚠️ Importante:</strong>
            <ul style="margin: 5px 0; padding-left: 20px;">
              <li>Este link expira em <strong>1 hora</strong></li>
              <li>Só pode ser usado <strong>uma vez</strong></li>
              <li>Se você não solicitou esta recuperação, ignore este email</li>
            </ul>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
            Por questões de segurança, nunca compartilhe este link com ninguém.
          </p>
        </div>
        
        <div class="footer">
          <p>
            Este é um email automático, por favor não responda.<br>
            © ${new Date().getFullYear()} Minhas Finanças - Todos os direitos reservados
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Olá, ${name}!
    
    Recebemos uma solicitação para redefinir a senha da sua conta no Minhas Finanças.
    
    Para criar uma nova senha, acesse o link abaixo:
    ${resetUrl}
    
    IMPORTANTE:
    - Este link expira em 1 hora
    - Só pode ser usado uma vez
    - Se você não solicitou esta recuperação, ignore este email
    
    Por questões de segurança, nunca compartilhe este link com ninguém.
    
    ---
    Este é um email automático, por favor não responda.
    © ${new Date().getFullYear()} Minhas Finanças
  `;

  await sendEmail({ to: email, subject, html, text });
};
