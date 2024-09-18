import dayjs from 'dayjs'
import { client, db } from '.'
import { goals, goalsCompletions } from './schema'

async function seed() {
  await db.delete(goalsCompletions)
  await db.delete(goals)

  const result = await db
    .insert(goals)
    .values([
      { title: 'Ir para academia', desiredWeeklyFrequency: 5 },
      { title: 'Aula de natação', desiredWeeklyFrequency: 3 },
      { title: 'Escrever', desiredWeeklyFrequency: 1 },
    ])
    .returning()

  const startOfWeek = dayjs().startOf('week')

  await db.insert(goalsCompletions).values([
    { goalId: result[0].id, createdAt: startOfWeek.toDate() },
    {
      goalId: result[1].id,
      createdAt: startOfWeek.add(1, 'day').toDate(),
    },
  ])
}

seed().finally(() => {
  client.end()
})
