// Projects that match an influencers stats

export default `
SELECT p.id, SUM(jsonb_array_length(pp.posts))
  FROM projects AS p
  JOIN projects_platforms AS pp ON pp.project_id = p.id
  JOIN projects_tags AS pt ON pt.project_id = p.id
  WHERE 
    (CASE WHEN p.must_be_over_twenty_five=true THEN 25
          WHEN p.must_be_over_twenty_five=false THEN 0
    END) <= (
      SELECT date_part('year', age(dob))
      FROM influencers as i
      WHERE i.id = :influencerId
    )
  AND ((
    SELECT COUNT(*)::float
    FROM influencers_tags
    WHERE influencer_id = :influencerId
    AND tag_id IN (
      SELECT tag_id
      FROM projects_tags
      WHERE project_id=p.id
    )) / NULLIF((
      SELECT COUNT(*)
      FROM projects_tags
      WHERE project_id=p.id 
    ), 0)
    >= 0.5
  )
  AND EXISTS (
    SELECT *
    FROM influencers_platforms AS ip
    JOIN projects_platforms AS ppp
    ON ppp.platform_id=ip.platform_id
    --social platforms
    WHERE influencer_id = :influencerId
    AND ip.option=ppp.option
    --demographics(age range, gender, location)
    AND
      (CASE WHEN primary_age_range='13-17' THEN age_distribution_1317
          WHEN primary_age_range='18-24' THEN age_distribution_1824
          WHEN primary_age_range='25-34' THEN age_distribution_2534 
          WHEN primary_age_range='35-44' THEN age_distribution_3544 
          WHEN primary_age_range='44+' THEN age_distribution_over_45
      END) >= 25
    AND
      (CASE WHEN primary_gender='male' THEN male_audience
          WHEN primary_gender='female' THEN female_audience
          WHEN primary_gender='neither' THEN 100
      END) >= 60
    AND p.location_place_id IN (
      SELECT location_place_id
      FROM influencers_platforms_locations as ipl
      WHERE ipl.influencers_platform_id=ip.id
    )
  )
GROUP BY p.id
HAVING p.budget/NULLIF(SUM(jsonb_array_length(pp.posts)),0) * 0.85 <= (
  SELECT MIN(price_per_content)
  FROM influencers_platforms
  WHERE influencer_id = :influencerId
)
AND p.budget/NULLIF(SUM(jsonb_array_length(pp.posts)),0) * 1.15 <= (
  SELECT MIN(price_per_content)
  FROM influencers_platforms
  WHERE influencer_id = :influencerId
)
ORDER BY 
  (
    SELECT COUNT(*)::float
    FROM influencers_tags
    WHERE influencer_id = :influencerId
    AND tag_id IN (
      SELECT tag_id
      FROM projects_tags
      WHERE project_id=p.id
    )) / NULLIF((
    SELECT COUNT(*)
    FROM projects_tags
    WHERE project_id=p.id 
  ),0) + (
    1 - ABS(p.budget/NULLIF(SUM(jsonb_array_length(pp.posts)),0) - (
      SELECT MIN(price_per_content)
      FROM influencers_platforms
      WHERE influencer_id = :influencerId
    ))
  ) + ((
    SELECT
      SUM (
        CASE WHEN primary_age_range='13-17' THEN age_distribution_1317
          WHEN primary_age_range='18-24' THEN age_distribution_1824
          WHEN primary_age_range='25-34' THEN age_distribution_2534 
          WHEN primary_age_range='35-44' THEN age_distribution_3544 
          WHEN primary_age_range='44+' THEN age_distribution_over_45
        END
      )
    FROM influencers_platforms AS ip
    JOIN projects_platforms AS pppp
    ON pppp.platform_id=ip.platform_id
    WHERE influencer_id = :influencerId
    AND ip.option=pppp.option
  ) / 100
) + ((
  SELECT 
    SUM (
      CASE WHEN primary_gender='male' THEN male_audience
        WHEN primary_gender='female' THEN female_audience
        WHEN primary_gender='neither' THEN 100
      END
    )
  FROM influencers_platforms AS ip
  JOIN projects_platforms AS pppp
  ON pppp.platform_id=ip.platform_id
  WHERE influencer_id = :influencerId
  AND ip.option=pppp.option
  ) / 100
)
DESC
`
