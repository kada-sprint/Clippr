const Joi = require('joi');

const fallbackSegmentSchema = Joi.object({
  start_time_seconds: Joi.number().min(0).required(),
  end_time_seconds: Joi.number().min(0).required(),
  duration: Joi.number().min(25).max(75).required(),
  concept_score: Joi.number().integer().min(0).max(98).allow(null).required(),
  suggested_title: Joi.string().min(1).required(),
  pedagogical_reason: Joi.string().max(280).allow(null).required(),
}).custom((value, helpers) => {
  if (value.end_time_seconds <= value.start_time_seconds) {
    return helpers.error('any.invalid', {
      message: 'end_time_seconds must be after start_time_seconds',
    });
  }
  const computed = value.end_time_seconds - value.start_time_seconds;
  if (Math.abs(computed - value.duration) > 0.5) {
    return helpers.error('any.invalid', {
      message: 'duration does not match end_time_seconds - start_time_seconds',
    });
  }
  return value;
});

const fallbackOutputSchema = Joi.object({
  segments: Joi.array().items(fallbackSegmentSchema).min(1).max(5).required(),
});

module.exports = fallbackOutputSchema;
