import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateFormInput,
  UpdateFormInput,
  CreateQuestionInput,
  UpdateQuestionInput,
  SubmitResponseInput,
  ReorderQuestionsInput,
} from './forms.schema';

export class FormsService {
  async create(userId: string, data: CreateFormInput) {
    return prisma.form.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        type: data.type,
        settings: data.settings ?? undefined,
        theme: data.theme ?? undefined,
      },
    });
  }

  async getAll(userId: string) {
    const forms = await prisma.form.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { responses: true } },
      },
    });

    return forms;
  }

  async getById(formId: string, userId?: string | null) {
    if (userId) {
      // Authenticated access — owner check
      const form = await prisma.form.findFirst({
        where: { id: formId, userId },
        include: {
          questions: { orderBy: { position: 'asc' } },
          _count: { select: { responses: true } },
        },
      });

      if (!form) throw new AppError(404, 'Form not found', 'NOT_FOUND');
      return form;
    }

    // Public access — must be published
    const form = await prisma.form.findFirst({
      where: { id: formId, isPublished: true },
      include: {
        questions: { orderBy: { position: 'asc' } },
      },
    });

    if (!form) throw new AppError(404, 'Form not found or not published', 'NOT_FOUND');
    return form;
  }

  async update(formId: string, userId: string, data: UpdateFormInput) {
    const form = await prisma.form.findFirst({ where: { id: formId, userId } });
    if (!form) throw new AppError(404, 'Form not found', 'NOT_FOUND');

    return prisma.form.update({
      where: { id: formId },
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        settings: data.settings ?? undefined,
        theme: data.theme ?? undefined,
        isPublished: data.isPublished,
        acceptResponses: data.acceptResponses,
        responseLimit: data.responseLimit,
        startDate: data.startDate ? new Date(data.startDate) : data.startDate === null ? null : undefined,
        endDate: data.endDate ? new Date(data.endDate) : data.endDate === null ? null : undefined,
      },
    });
  }

  async delete(formId: string, userId: string) {
    const form = await prisma.form.findFirst({ where: { id: formId, userId } });
    if (!form) throw new AppError(404, 'Form not found', 'NOT_FOUND');

    await prisma.form.delete({ where: { id: formId } });
  }

  async duplicate(formId: string, userId: string) {
    const form = await prisma.form.findFirst({
      where: { id: formId, userId },
      include: { questions: { orderBy: { position: 'asc' } } },
    });

    if (!form) throw new AppError(404, 'Form not found', 'NOT_FOUND');

    const duplicated = await prisma.form.create({
      data: {
        userId,
        title: `${form.title} (Copy)`,
        description: form.description,
        type: form.type,
        settings: form.settings ?? undefined,
        theme: form.theme ?? undefined,
        questions: {
          create: form.questions.map((q) => ({
            type: q.type,
            label: q.label,
            description: q.description,
            options: q.options ?? undefined,
            validation: q.validation ?? undefined,
            isRequired: q.isRequired,
            position: q.position,
            points: q.points,
            correctAnswer: q.correctAnswer ?? undefined,
            logic: q.logic ?? undefined,
          })),
        },
      },
      include: {
        questions: { orderBy: { position: 'asc' } },
      },
    });

    return duplicated;
  }

  async addQuestion(formId: string, userId: string, data: CreateQuestionInput) {
    const form = await prisma.form.findFirst({ where: { id: formId, userId } });
    if (!form) throw new AppError(404, 'Form not found', 'NOT_FOUND');

    return prisma.formQuestion.create({
      data: {
        formId,
        type: data.type,
        label: data.label,
        description: data.description,
        options: data.options ?? undefined,
        validation: data.validation ?? undefined,
        isRequired: data.isRequired,
        position: data.position,
        points: data.points,
        correctAnswer: data.correctAnswer ?? undefined,
        logic: data.logic ?? undefined,
      },
    });
  }

  async updateQuestion(questionId: string, userId: string, data: UpdateQuestionInput) {
    const question = await prisma.formQuestion.findFirst({
      where: { id: questionId, form: { userId } },
    });

    if (!question) throw new AppError(404, 'Question not found', 'NOT_FOUND');

    return prisma.formQuestion.update({
      where: { id: questionId },
      data: {
        type: data.type,
        label: data.label,
        description: data.description,
        options: data.options ?? undefined,
        validation: data.validation ?? undefined,
        isRequired: data.isRequired,
        position: data.position,
        points: data.points,
        correctAnswer: data.correctAnswer ?? undefined,
        logic: data.logic ?? undefined,
      },
    });
  }

  async deleteQuestion(questionId: string, userId: string) {
    const question = await prisma.formQuestion.findFirst({
      where: { id: questionId, form: { userId } },
    });

    if (!question) throw new AppError(404, 'Question not found', 'NOT_FOUND');

    await prisma.formQuestion.delete({ where: { id: questionId } });
  }

  async reorderQuestions(formId: string, userId: string, data: ReorderQuestionsInput) {
    const form = await prisma.form.findFirst({ where: { id: formId, userId } });
    if (!form) throw new AppError(404, 'Form not found', 'NOT_FOUND');

    const updates = data.questionIds.map((id, index) =>
      prisma.formQuestion.update({
        where: { id },
        data: { position: index },
      })
    );

    await prisma.$transaction(updates);
  }

  async submitResponse(formId: string, data: SubmitResponseInput, respondentId?: string) {
    const form = await prisma.form.findFirst({
      where: { id: formId, isPublished: true },
      include: { questions: true },
    });

    if (!form) throw new AppError(404, 'Form not found or not published', 'NOT_FOUND');
    if (!form.acceptResponses) throw new AppError(400, 'Form is not accepting responses', 'RESPONSES_CLOSED');

    // Check date constraints
    const now = new Date();
    if (form.startDate && now < form.startDate) {
      throw new AppError(400, 'Form is not yet open for responses', 'FORM_NOT_STARTED');
    }
    if (form.endDate && now > form.endDate) {
      throw new AppError(400, 'Form response period has ended', 'FORM_ENDED');
    }

    // Check response limit
    if (form.responseLimit) {
      const responseCount = await prisma.formResponse.count({ where: { formId } });
      if (responseCount >= form.responseLimit) {
        throw new AppError(400, 'Response limit reached', 'RESPONSE_LIMIT_REACHED');
      }
    }

    // Auto-grade if quiz
    let score: number | null = null;
    let maxScore: number | null = null;

    if (form.type === 'QUIZ') {
      maxScore = 0;
      score = 0;

      for (const question of form.questions) {
        if (question.points != null && question.correctAnswer != null) {
          maxScore += question.points;
          const userAnswer = data.answers[question.id];

          if (userAnswer !== undefined) {
            const correct = JSON.stringify(userAnswer) === JSON.stringify(question.correctAnswer);
            if (correct) {
              score += question.points;
            }
          }
        }
      }
    }

    return prisma.formResponse.create({
      data: {
        formId,
        respondentId: respondentId ?? null,
        respondentName: data.respondentName,
        respondentEmail: data.respondentEmail,
        answers: data.answers,
        score,
        maxScore,
      },
    });
  }

  async getResponses(formId: string, userId: string) {
    const form = await prisma.form.findFirst({ where: { id: formId, userId } });
    if (!form) throw new AppError(404, 'Form not found', 'NOT_FOUND');

    return prisma.formResponse.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getResponseById(responseId: string, userId: string) {
    const response = await prisma.formResponse.findFirst({
      where: { id: responseId, form: { userId } },
      include: { form: { include: { questions: { orderBy: { position: 'asc' } } } } },
    });

    if (!response) throw new AppError(404, 'Response not found', 'NOT_FOUND');
    return response;
  }

  async getAnalytics(formId: string, userId: string) {
    const form = await prisma.form.findFirst({
      where: { id: formId, userId },
      include: { questions: { orderBy: { position: 'asc' } } },
    });

    if (!form) throw new AppError(404, 'Form not found', 'NOT_FOUND');

    const responses = await prisma.formResponse.findMany({
      where: { formId },
    });

    const totalResponses = responses.length;

    // Per-question analytics
    const questionSummaries = form.questions.map((question) => {
      const questionAnswers = responses
        .map((r) => {
          const answers = r.answers as Record<string, unknown>;
          return answers[question.id];
        })
        .filter((a) => a !== undefined && a !== null);

      const answered = questionAnswers.length;
      const summary: Record<string, unknown> = {
        questionId: question.id,
        label: question.label,
        type: question.type,
        totalAnswered: answered,
        skipped: totalResponses - answered,
      };

      // Choice-based questions: count per option
      if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DROPDOWN'].includes(question.type)) {
        const optionCounts: Record<string, number> = {};
        for (const answer of questionAnswers) {
          if (Array.isArray(answer)) {
            for (const val of answer) {
              optionCounts[String(val)] = (optionCounts[String(val)] || 0) + 1;
            }
          } else {
            optionCounts[String(answer)] = (optionCounts[String(answer)] || 0) + 1;
          }
        }
        summary.optionCounts = optionCounts;
      }

      // Rating-based questions: average
      if (['STAR_RATING', 'LIKERT', 'NUMBER', 'RANGE'].includes(question.type)) {
        const numericAnswers = questionAnswers
          .map((a) => Number(a))
          .filter((n) => !isNaN(n));

        if (numericAnswers.length > 0) {
          summary.average = numericAnswers.reduce((sum, n) => sum + n, 0) / numericAnswers.length;
          summary.min = Math.min(...numericAnswers);
          summary.max = Math.max(...numericAnswers);
        }
      }

      // NPS: promoter/passive/detractor
      if (question.type === 'NPS') {
        let promoters = 0;
        let passives = 0;
        let detractors = 0;

        for (const answer of questionAnswers) {
          const val = Number(answer);
          if (isNaN(val)) continue;
          if (val >= 9) promoters++;
          else if (val >= 7) passives++;
          else detractors++;
        }

        summary.promoters = promoters;
        summary.passives = passives;
        summary.detractors = detractors;

        const totalNps = promoters + passives + detractors;
        summary.npsScore = totalNps > 0
          ? Math.round(((promoters - detractors) / totalNps) * 100)
          : null;
      }

      return summary;
    });

    // Completion rate: responses with all required questions answered / total responses
    const requiredQuestionIds = form.questions
      .filter((q) => q.isRequired)
      .map((q) => q.id);

    let completedResponses = 0;
    for (const response of responses) {
      const answers = response.answers as Record<string, unknown>;
      const allRequiredAnswered = requiredQuestionIds.every(
        (qId) => answers[qId] !== undefined && answers[qId] !== null && answers[qId] !== ''
      );
      if (allRequiredAnswered) completedResponses++;
    }

    const completionRate = totalResponses > 0
      ? Math.round((completedResponses / totalResponses) * 100)
      : 0;

    return {
      totalResponses,
      completionRate,
      questionSummaries,
    };
  }

  async deleteResponse(responseId: string, userId: string) {
    const response = await prisma.formResponse.findFirst({
      where: { id: responseId, form: { userId } },
    });

    if (!response) throw new AppError(404, 'Response not found', 'NOT_FOUND');

    await prisma.formResponse.delete({ where: { id: responseId } });
  }
}

export const formsService = new FormsService();
