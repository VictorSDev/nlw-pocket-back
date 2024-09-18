import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import { goals, goalsCompletions } from '../db/schema'
import dayjs from 'dayjs'

type GoalsPerDay = Record<
  string,
  {
    id: string
    title: string
    completedAt: string
  }[]
>

export async function getWeekSummary() {
  const firstDayOfWeek = dayjs().startOf('week').toDate()
  const lastDayOfWeek = dayjs().endOf('week').toDate()

  const goalsCreatedUpWeek = db.$with('goals_created_up_to_week').as(
    db
      .select({
        id: goals.id,
        title: goals.title,
        desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
        createdAt: goals.createdAt,
      })
      .from(goals)
      .where(lte(goals.createdAt, lastDayOfWeek))
  )

  const goalsCompletedsInWeek = db.$with('goals_completeds_in_week').as(
    db
      .select({
        id: goalsCompletions.id,
        title: goals.title,
        completedAt: goalsCompletions.createdAt,
        completedAtDate: sql /*sql*/`
          DATE(${goalsCompletions.createdAt})
        `.as('completedAtDate'),
      })
      .from(goalsCompletions)
      .innerJoin(goals, eq(goals.id, goalsCompletions.goalId))
      .where(
        and(
          gte(goalsCompletions.createdAt, firstDayOfWeek),
          lte(goalsCompletions.createdAt, lastDayOfWeek)
        )
      )
      .orderBy(desc(goalsCompletions.createdAt))
  )

  const goalsCompletedByWeekDay = db.$with('goals_completed_by_week_day').as(
    db
      .select({
        completedAtDate: goalsCompletedsInWeek.completedAtDate,
        completions: sql /*sql*/`
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', ${goalsCompletedsInWeek.id},
              'title', ${goalsCompletedsInWeek.title},
              'completedAt', ${goalsCompletedsInWeek.completedAt}
            )
          )
        `.as('completions'),
      })
      .from(goalsCompletedsInWeek)
      .groupBy(goalsCompletedsInWeek.completedAtDate)
      .orderBy(desc(goalsCompletedsInWeek.completedAtDate))
  )

  const result = await db
    .with(goalsCreatedUpWeek, goalsCompletedsInWeek, goalsCompletedByWeekDay)
    .select({
      completed: sql /*sql*/`
        (SELECT COUNT(*) FROM ${goalsCompletedsInWeek})
      `.mapWith(Number),
      total: sql /*sql*/`
      (SELECT SUM(${goalsCreatedUpWeek.desiredWeeklyFrequency}) FROM ${goalsCreatedUpWeek})
    `.mapWith(Number),
      goalsPerDay: sql<GoalsPerDay> /*sql*/`
    JSON_OBJECT_AGG(
      ${goalsCompletedByWeekDay.completedAtDate},
      ${goalsCompletedByWeekDay.completions}
    )
  `,
    })
    .from(goalsCompletedByWeekDay)

  return { summary: result[0] }
}
