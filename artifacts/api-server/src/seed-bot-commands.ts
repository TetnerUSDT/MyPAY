import { db } from './db';
import { botCommands, botCommandReactions, botMenus, botMenuButtons } from '@workspace/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Seed script to populate initial bot commands, menus and buttons
 * This migrates hardcoded commands from routes.ts to the database
 */
async function seedBotCommands() {
  try {
    console.log('🌱 Starting bot commands seed...');

    // 1. Create /start command
    let startCommand = await db
      .select()
      .from(botCommands)
      .where(eq(botCommands.command, '/start'))
      .limit(1)
      .then(rows => rows[0]);

    if (!startCommand) {
      await db
        .insert(botCommands)
        .values({
          command: '/start',
          description: 'Начать работу с ботом',
          isActive: true,
        });
      
      startCommand = await db
        .select()
        .from(botCommands)
        .where(eq(botCommands.command, '/start'))
        .limit(1)
        .then(rows => rows[0]);
      
      console.log('✅ Created /start command:', startCommand!.id);
    } else {
      console.log('✅ /start command already exists:', startCommand.id);
    }

    // 2. Create reaction for /start command
    const existingStartReaction = await db
      .select()
      .from(botCommandReactions)
      .where(eq(botCommandReactions.commandId, startCommand.id))
      .limit(1)
      .then(rows => rows[0]);

    if (!existingStartReaction) {
      await db
        .insert(botCommandReactions)
        .values({
          commandId: startCommand.id,
          reactionType: 'text',
          textContent: 'Добро пожаловать в SwiftX! 👋\n\nВыберите один из пунктов меню ниже:',
          priority: 1,
          isActive: true,
        });
      console.log('✅ Created /start reaction');
    } else {
      console.log('✅ /start reaction already exists');
    }

    // 3. Create root menu
    let rootMenu = await db
      .select()
      .from(botMenus)
      .where(eq(botMenus.title, 'Главное меню'))
      .limit(1)
      .then(rows => rows[0]);

    if (!rootMenu) {
      await db
        .insert(botMenus)
        .values({
          title: 'Главное меню',
          keyboardType: 'reply',
          rows: 1,
          columns: 2,
          isRoot: true,
          isActive: true,
        });
      
      rootMenu = await db
        .select()
        .from(botMenus)
        .where(eq(botMenus.title, 'Главное меню'))
        .limit(1)
        .then(rows => rows[0]);
      
      console.log('✅ Created root menu:', rootMenu!.id);
    } else {
      console.log('✅ Root menu already exists:', rootMenu.id);
    }

    // 4. Create menu buttons
    const buttons = [
      {
        menuId: rootMenu.id,
        text: '📃Условия P2P',
        rowIndex: 0,
        columnIndex: 0,
        actionType: 'command' as const,
        actionValue: 'p2p_terms',
        isActive: true,
      },
      {
        menuId: rootMenu.id,
        text: '💸Кешбек',
        rowIndex: 0,
        columnIndex: 1,
        actionType: 'command' as const,
        actionValue: 'cashback',
        isActive: true,
      },
    ];

    const existingButtons = await db
      .select()
      .from(botMenuButtons)
      .where(eq(botMenuButtons.menuId, rootMenu.id));

    if (existingButtons.length === 0) {
      for (const button of buttons) {
        await db
          .insert(botMenuButtons)
          .values(button);
      }
      console.log('✅ Created menu buttons');
    } else {
      console.log('✅ Menu buttons already exist');
    }

    // 5. Create command for P2P terms
    let p2pCommand = await db
      .select()
      .from(botCommands)
      .where(eq(botCommands.command, 'p2p_terms'))
      .limit(1)
      .then(rows => rows[0]);

    if (!p2pCommand) {
      await db
        .insert(botCommands)
        .values({
          command: 'p2p_terms',
          description: 'Условия работы P2P обменника',
          isActive: true,
        });
      
      p2pCommand = await db
        .select()
        .from(botCommands)
        .where(eq(botCommands.command, 'p2p_terms'))
        .limit(1)
        .then(rows => rows[0]);
    }

    const p2pTermsText = `💼 Условия работы P2P обменника

1. Минимальная сумма обмена:
от 100 ₽ и выше

2. Формат работы:
• Обмен происходит в формате P2P (клиент ↔️ клиент)
• Оплата производится в криптовалюте (USDT)
• На время сделки криптовалюта замораживается до полного завершения оплаты

3. Процесс обмена:
• Оплата фиатом (₽) может проходить несколькими платежами с интервалом в несколько минут — это помогает избежать блокировок банковских переводов
• После каждого поступления платежа клиент обязан уведомить техподдержку в течение 15 минут

4. Коммуникация:
• Клиент должен оставаться на связи с техподдержкой до полного завершения сделки
• Все подтверждения о поступлении платежей направляются в чат поддержки

5. Безопасность средств:
• Ваша криптовалюта находится в заморозке до подтверждения всех платежей
• Если оплата не поступила — средства остаются у вас и доступны для вывода
• Если на карту поступила неполная сумма, остаток автоматически возвращается на ваш криптокошелёк`;

    const existingP2PReaction = await db
      .select()
      .from(botCommandReactions)
      .where(eq(botCommandReactions.commandId, p2pCommand.id))
      .limit(1)
      .then(rows => rows[0]);

    if (!existingP2PReaction) {
      await db
        .insert(botCommandReactions)
        .values({
          commandId: p2pCommand.id,
          reactionType: 'text',
          textContent: p2pTermsText,
          priority: 1,
          isActive: true,
        });
      console.log('✅ Created P2P terms command and reaction');
    } else {
      console.log('✅ P2P terms reaction already exists');
    }

    // 6. Create command for Cashback
    let cashbackCommand = await db
      .select()
      .from(botCommands)
      .where(eq(botCommands.command, 'cashback'))
      .limit(1)
      .then(rows => rows[0]);

    if (!cashbackCommand) {
      await db
        .insert(botCommands)
        .values({
          command: 'cashback',
          description: 'Информация о кешбеке',
          isActive: true,
        });
      
      cashbackCommand = await db
        .select()
        .from(botCommands)
        .where(eq(botCommands.command, 'cashback'))
        .limit(1)
        .then(rows => rows[0]);
    }

    const existingCashbackReaction = await db
      .select()
      .from(botCommandReactions)
      .where(eq(botCommandReactions.commandId, cashbackCommand.id))
      .limit(1)
      .then(rows => rows[0]);

    if (!existingCashbackReaction) {
      await db
        .insert(botCommandReactions)
        .values({
          commandId: cashbackCommand.id,
          reactionType: 'text',
          textContent: 'Ожидайте, скоро появиться информация!',
          priority: 1,
          isActive: true,
        });
      console.log('✅ Created Cashback command and reaction');
    } else {
      console.log('✅ Cashback reaction already exists');
    }

    console.log('🎉 Bot commands seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding bot commands:', error);
    process.exit(1);
  }
}

seedBotCommands();
